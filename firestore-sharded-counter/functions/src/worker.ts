/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { firestore } from "firebase-admin";
import * as deepEqual from "deep-equal";

import {
  Slice,
  WorkerStats,
  isEmpty,
  isUpdatedFrequently,
  queryRange,
} from "./common";
import { Planner } from "./planner";
import { Aggregator } from "./aggregator";

const SHARDS_LIMIT = 499;
const WORKER_TIMEOUT_MS = 45000;

interface WorkerMetadata {
  slice: Slice; // shard range a single worker is responsible for
  stats: WorkerStats; // stats written by a worker at the end of successful run
  timestamp: number; // timestamp is updated each time metadata is modified to detect changes
}

/**
 * Worker is controlled by WorkerMetadata document stored at process.env.MODS_INTERNAL_COLLECTION
 * path. Controller creates as many metadata documents as workers are required. Each worker monitors
 * exclusive shard range (aka slice) and terminates successfully after 45 seconds, upon which it
 * writes stats to its metadata document. That write triggers another worker run in GCF. This means
 * workers are self scheduling.
 *
 * If worker run fails, controller will detect that after 90s and reschedule worker by updating
 * 'timestamp' field.
 *
 * Workers avoid double scheduling and overruns by including their metadata documents in every
 * aggregation transaction. If metadata changes underneath, transaction fails, worker detects that
 * and terminates immmediately.
 */
export class ShardedCounterWorker {
  private db: firestore.Firestore;
  private metadata: WorkerMetadata;

  // worker state
  private shards: firestore.QueryDocumentSnapshot[] = null;
  private aggregation: Promise<void> = null;
  private allPaths: string[] = [];
  private rounds: number = 0;
  private roundsCapped: number = 0;

  constructor(
    private metadoc: firestore.DocumentSnapshot,
    private shardCollection: string,
    private singleRun: boolean = false
  ) {
    this.db = metadoc.ref.firestore;
    this.metadoc = metadoc;
    this.metadata = <WorkerMetadata>metadoc.data();
  }

  public run(): Promise<void> {
    return new Promise((resolve, reject) => {
      let intervalTimer: any;
      let timeoutTimer: any;
      let unsubscribeMetadataListener: (() => void);
      let unsubscribeSliceListener: (() => void);

      const shutdown = async () => {
        clearInterval(intervalTimer);
        clearTimeout(timeoutTimer);
        unsubscribeMetadataListener();
        unsubscribeSliceListener();
        if (this.aggregation != null) {
          try {
            await this.aggregation;
          } catch (err) {
            // Not much here we can do, transaction is over.
          }
        }
      };

      const writeStats = async () => {
        this.allPaths.sort();
        let splits = this.allPaths.filter(
          (val, idx) => idx !== 0 && idx % 100 === 0
        );
        let stats: WorkerStats = {
          shardsAggregated: this.allPaths.length,
          splits: splits,
          lastSuccessfulRun: Date.now(),
          rounds: this.rounds,
          roundsCapped: this.roundsCapped,
        };
        await this.db.runTransaction(async (t) => {
          const snap = await t.get(this.metadoc.ref);
          if (snap.exists && deepEqual(snap.data(), this.metadata)) {
            t.update(snap.ref, { timestamp: Date.now(), stats: stats });
          }
        });
      };

      intervalTimer = setInterval(() => {
        this.maybeAggregate();
      }, 1000);

      timeoutTimer = setTimeout(
        () =>
          shutdown()
            .then(writeStats)
            .then(resolve)
            .catch(reject),
        WORKER_TIMEOUT_MS
      );

      unsubscribeMetadataListener = this.metadoc.ref.onSnapshot((snap) => {
        console.log("metadoc update");
        // if something's changed in the worker metadata since we were called, abort.
        if (!snap.exists || !deepEqual(snap.data(), this.metadata)) {
          console.log("shutting down cause metadoc changed.");
          shutdown()
            .then(resolve)
            .catch(reject);
        }
      });

      unsubscribeSliceListener = queryRange(
        this.db,
        this.shardCollection,
        this.metadata.slice.start,
        this.metadata.slice.end,
        SHARDS_LIMIT
      ).onSnapshot((snap) => {
        this.shards = snap.docs;
        if (this.singleRun && this.shards.length === 0) {
          console.log("Shutting down, single run mode.");
          shutdown()
            .then(writeStats)
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  protected maybeAggregate() {
    if (this.aggregation != null || this.shards === null) return;

    this.rounds++;
    if (this.shards.length === SHARDS_LIMIT) this.roundsCapped++;

    // Identify empty shards that are candidates for cleanup.
    const [fulls, empties] = ShardedCounterWorker.separateShards(
      this.shards,
      this.singleRun
    );
    const cleanupPromises = ShardedCounterWorker.cleanupEmptyPartials(
      this.db,
      empties
    );

    const plans = Planner.planAggregations(this.metadata.slice.start, fulls);

    const promises = plans.map(async (plan) => {
      try {
        const paths = await this.db.runTransaction(async (t) => {
          const paths = [];

          // Read metadata document in transaction to guarantee ownership of the slice.
          const metadocPromise = t.get(this.metadoc.ref);

          // Read the main counter in transaction, we don't use numeric transform here yet.
          const counterPromise = plan.isPartial
            ? Promise.resolve(null)
            : t.get(this.db.doc(plan.aggregate));

          // Read all shards in a transaction since we want to delete them immediately.
          // Note that partials are not read here, because we use array transform to
          // update them and don't need transaction guarantees.
          const shardRefs = plan.shards.map((snap) => snap.ref);
          const shardsPromise =
            shardRefs.length > 0
              ? t.getAll(shardRefs[0], ...shardRefs.slice(1))
              : Promise.resolve([]);
          let shards: firestore.DocumentSnapshot[];
          let counter: firestore.DocumentSnapshot;
          let metadoc: firestore.DocumentSnapshot;
          try {
            [shards, counter, metadoc] = await Promise.all([
              shardsPromise,
              counterPromise,
              metadocPromise,
            ]);
          } catch (err) {
            console.log(
              "Unable to read shards during aggregation round, skipping...",
              err
            );
            return [];
          }

          // Check that we still own the slice.
          if (!metadoc.exists || !deepEqual(metadoc.data(), this.metadata)) {
            console.log("Metadata has changed, bailing out...");
            return [];
          }

          // Calculate aggregated value and save to aggregate shard.
          let update = Aggregator.aggregate(counter, plan.partials, shards);
          t.set(this.db.doc(plan.aggregate), update, { merge: true });

          // Delete shards that have been aggregated.
          shards.forEach((snap) => {
            if (snap.exists) {
              paths.push(snap.ref.path);
              t.delete(snap.ref);
            }
          });

          // Decrement partials by the amount that have been aggregated.
          plan.partials.forEach((snap) => {
            if (snap.exists) {
              const data = snap.data();
              if ("_updates_" in data && data["_updates_"].length > 0) {
                paths.push(snap.ref.path);
                t.set(
                  snap.ref,
                  {
                    _updates_: firestore.FieldValue.arrayRemove(
                      ...data["_updates_"]
                    ),
                  },
                  { merge: true }
                );
              }
            }
          });
          return paths;
        });
        this.allPaths.push(...paths);
      } catch (err) {
        console.log(
          "transaction to: " + plan.aggregate + " failed, skipping...",
          err
        );
      }
    });
    if (promises.length === 0 && cleanupPromises.length === 0) return;

    this.aggregation = Promise.all(promises.concat(cleanupPromises)).then(
      () => {
        // once this aggregation is done mark it as such
        this.aggregation = null;
        return;
      }
    );
  }

  protected static separateShards(
    shards: firestore.DocumentSnapshot[],
    singleRun: boolean
  ): [firestore.DocumentSnapshot[], firestore.DocumentSnapshot[]] {
    const fulls = [];
    const empties = [];
    shards.forEach((shard) => {
      if (
        shard.exists &&
        isEmpty(shard.data()) &&
        (!isUpdatedFrequently(shard) || singleRun)
      ) {
        empties.push(shard);
      } else {
        fulls.push(shard);
      }
    });
    return [fulls, empties];
  }

  protected static cleanupEmptyPartials(
    db: firestore.Firestore,
    empties: firestore.DocumentSnapshot[]
  ): Promise<void>[] {
    return empties.map(async (empty) => {
      try {
        await db.runTransaction(async (t) => {
          try {
            const snap = await t.get(empty.ref);
            if (snap.exists && isEmpty(snap.data())) {
              t.delete(snap.ref);
            }
          } catch (err) {
            console.log("deletion failed: " + empty.ref.path);
          }
        });
      } catch (err) {
        console.log(
          "transaction to delete: " + empty.ref.path + " failed, skipping",
          err
        );
      }
    });
  }
}

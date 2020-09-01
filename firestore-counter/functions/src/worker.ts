/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { firestore } from "firebase-admin";
import * as deepEqual from "deep-equal";
import { logger } from "firebase-functions";

import {
  Slice,
  WorkerStats,
  isUpdatedFrequently,
  queryRange,
  containsManyUpdates,
} from "./common";
import { Planner } from "./planner";
import { Aggregator, NumericUpdate } from "./aggregator";
import * as uuid from "uuid";

const SHARDS_LIMIT = 100;
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
 * and terminates immediately.
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
        try {
          await this.db.runTransaction(async (t) => {
            try {
              const snap = await t.get(this.metadoc.ref);
              if (snap.exists && deepEqual(snap.data(), this.metadata)) {
                t.update(snap.ref, {
                  timestamp: firestore.FieldValue.serverTimestamp(),
                  stats: stats,
                });
              }
            } catch (err) {
              logger.log("Failed to save writer stats.", err);
            }
          });
        } catch (err) {
          logger.log("Failed to save writer stats.", err);
        }
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
        // if something's changed in the worker metadata since we were called, abort.
        if (!snap.exists || !deepEqual(snap.data(), this.metadata)) {
          logger.log("Shutting down because metadoc changed.");
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
          logger.log("Shutting down, single run mode.");
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

    // Identify partial shards that are candidates for cleanup.
    const [toAggregate, toCleanup] = ShardedCounterWorker.categorizeShards(
      this.shards,
      this.singleRun
    );

    const cleanupPromises = ShardedCounterWorker.cleanupPartials(
      this.db,
      toCleanup
    );

    const plans = Planner.planAggregations(
      this.metadata.slice.start,
      toAggregate
    );

    const promises = plans.map(async (plan) => {
      try {
        const paths = await this.db.runTransaction(async (t) => {
          const paths = [];

          // Read metadata document in transaction to guarantee ownership of the slice.
          const metadocPromise = t.get(this.metadoc.ref);

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
            logger.log(
              "Unable to read shards during aggregation round, skipping...",
              err
            );
            return [];
          }

          // Check that we still own the slice.
          if (!metadoc.exists || !deepEqual(metadoc.data(), this.metadata)) {
            logger.log("Metadata has changed, bailing out...");
            return [];
          }

          // Calculate aggregated value and save to aggregate shard.
          const aggr = new Aggregator();
          const update = aggr.aggregate(counter, plan.partials, shards);
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
              const decrement = aggr.subtractPartial(snap);
              t.set(snap.ref, decrement, { merge: true });
            }
          });
          return paths;
        });
        this.allPaths.push(...paths);
      } catch (err) {
        logger.log(
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

  //TODO increase test coverage
  protected static categorizeShards(
    shards: firestore.DocumentSnapshot[],
    singleRun: boolean
  ): [firestore.DocumentSnapshot[], firestore.DocumentSnapshot[]] {
    const toAggregate = [];
    const toCleanup = [];
    shards.forEach((shard) => {
      // Don't aggregate empty partials, instead consider them for cleanup.
      if (shard.exists && isEmptyPartial(shard.data())) {
        if (!isUpdatedFrequently(shard) || singleRun) toCleanup.push(shard);
        return;
      }
      // Partials that have many updates should be cleaned up (i.e. compacted), but need to be aggregated as well.
      if (shard.exists && containsManyUpdates(shard)) {
        toCleanup.push(shard);
        toAggregate.push(shard);
        return;
      }
      // Everything else needs aggregation.
      toAggregate.push(shard);
    });
    return [toAggregate, toCleanup];
  }

  /**
   * Deletes empty partials and compacts non-empty ones.
   */
  protected static cleanupPartials(
    db: firestore.Firestore,
    toCleanup: firestore.DocumentSnapshot[]
  ): Promise<void>[] {
    return toCleanup.map(async (partial) => {
      try {
        await db.runTransaction(async (t) => {
          try {
            const snap = await t.get(partial.ref);
            if (snap.exists && isEmptyPartial(snap.data())) {
              t.delete(snap.ref);
            } else if (snap.exists) {
              const update = new NumericUpdate();
              const data = snap.data();
              if ("_updates_" in data) {
                data["_updates_"].forEach((u) => {
                  update.mergeFrom(u["_data_"]);
                });
              }
              t.set(snap.ref, update.toPartialShard(() => uuid.v4()));
            }
          } catch (err) {
            logger.log("Partial cleanup failed: " + partial.ref.path);
          }
        });
      } catch (err) {
        logger.log(
          "transaction to delete: " + partial.ref.path + " failed, skipping",
          err
        );
      }
    });
  }
}

function isEmptyPartial(data: { [key: string]: any }): boolean {
  // Check if this is a partial at all
  if (Object.keys(data).length > 1) return false;
  if (Object.keys(data).length === 1 && !("_updates_" in data)) return false;
  if (Object.keys(data).length === 0) return true;

  const update = new NumericUpdate();
  data["_updates_"].forEach((u) => {
    update.mergeFrom(u["_data_"]);
  });
  return update.isNoop();
}

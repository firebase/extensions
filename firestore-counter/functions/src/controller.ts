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
import { Slice, WorkerStats, queryRange } from "./common";
import { Planner } from "./planner";
import { Aggregator } from "./aggregator";
import { logger } from "firebase-functions";

export interface WorkerShardingInfo {
  slice: Slice; // shard range a single worker is responsible for
  hasData: boolean; // has this worker run at least once and we got stats
  overloaded: boolean; // is this worker overloaded
  splits: string[]; // processed shards sampled 1/100, useful to calculate new slices
}

export interface ControllerData {
  workers: Slice[];
  timestamp: number;
}
const EMPTY_CONTROLLER_DATA = { workers: [], timestamp: 0 };

export enum ControllerStatus {
  WORKERS_RUNNING,
  TOO_MANY_SHARDS,
  SUCCESS,
  FAILURE,
}

/**
 * Controller is run every minute by Cloud Scheduler and monitors health of workers via their
 * metadata documents. If any worker is overloaded or average worker load is below
 * 1000 shards/minute workers will be rebalanced based on their reported stats.
 *
 * Additionally it'll try to aggregate up to 200 shards in-line to avoid starting dedicated
 * workers for low traffic workloads.
 */
export class ShardedCounterController {
  private workersRef: firestore.CollectionReference;
  private db: firestore.Firestore;
  constructor(
    private controllerDocRef: firestore.DocumentReference,
    private shardCollectionId: string
  ) {
    if (controllerDocRef) {
      this.workersRef = controllerDocRef.collection("workers");
      this.db = controllerDocRef.firestore;
    }
  }

  /**
   * Try aggregating up to 'limit' shards for a fixed amount of time. If workers
   * are running or there's too many shards, it won't run aggregations at all.
   */
  public async aggregateContinuously(
    slice: Slice,
    limit: number,
    timeoutMillis: number
  ) {
    return new Promise((resolve, reject) => {
      let aggrPromise: Promise<ControllerStatus> = null;
      let controllerData: ControllerData = EMPTY_CONTROLLER_DATA;
      let rounds = 0;
      let skippedRoundsDueToWorkers = 0;
      let shardsCount = 0;

      let unsubscribeControllerListener = this.controllerDocRef.onSnapshot(
        (snap) => {
          if (snap.exists) {
            controllerData = <ControllerData>snap.data();
          }
        }
      );

      let unsubscribeSliceListener = queryRange(
        this.db,
        this.shardCollectionId,
        slice.start,
        slice.end,
        limit
      ).onSnapshot(async (snap) => {
        if (snap.docs.length == limit) return;
        if (controllerData.workers.length > 0) {
          skippedRoundsDueToWorkers++;
          return;
        }
        if (aggrPromise === null) {
          aggrPromise = this.aggregateOnce(slice, limit);
          const status = await aggrPromise;
          aggrPromise = null;
          if (status === ControllerStatus.SUCCESS) {
            shardsCount += snap.docs.length;
            rounds++;
          }
        }
      });

      const shutdown = async () => {
        logger.log(
          "Successfully ran " +
            rounds +
            " rounds. Aggregated " +
            shardsCount +
            " shards."
        );
        logger.log(
          "Skipped " +
            skippedRoundsDueToWorkers +
            " rounds due to workers running."
        );
        unsubscribeControllerListener();
        unsubscribeSliceListener();
        if (aggrPromise === null) await aggrPromise;
        resolve();
      };
      setTimeout(shutdown, timeoutMillis);
    });
  }

  /**
   * Try aggregating up to 'limit' shards. If workers are running or there's too many
   * shards return with appropriate status code.
   */
  public async aggregateOnce(
    slice: Slice,
    limit: number
  ): Promise<ControllerStatus> {
    try {
      const status = await this.db.runTransaction(async (t) => {
        let controllerDoc = null;
        try {
          controllerDoc = await t.get(this.controllerDocRef);
        } catch (err) {
          logger.log(
            "Failed to read controller doc: " + this.controllerDocRef.path
          );
          throw Error("Failed to read controller doc.");
        }
        const controllerData: ControllerData = controllerDoc.exists
          ? controllerDoc.data()
          : EMPTY_CONTROLLER_DATA;
        if (controllerData.workers.length > 0)
          return ControllerStatus.WORKERS_RUNNING;

        let shards: firestore.QuerySnapshot = null;
        try {
          shards = await t.get(
            queryRange(
              this.db,
              this.shardCollectionId,
              slice.start,
              slice.end,
              limit
            )
          );
        } catch (err) {
          logger.log("Query to find shards to aggregate failed.", err);
          throw Error("Query to find shards to aggregate failed.");
        }
        if (shards.docs.length == 200) return ControllerStatus.TOO_MANY_SHARDS;

        const plans = Planner.planAggregations("", shards.docs);
        const promises = plans.map(async (plan) => {
          if (plan.isPartial) {
            throw Error(
              "Aggregation plan in controller run resulted in partial shard, " +
                "this should never happen!"
            );
          }
          let counter: firestore.DocumentSnapshot = null;
          try {
            counter = await t.get(this.db.doc(plan.aggregate));
          } catch (err) {
            logger.log("Failed to read document: " + plan.aggregate, err);
            throw Error("Failed to read counter " + plan.aggregate);
          }
          // Calculate aggregated value and save to aggregate shard.
          const aggr = new Aggregator();
          const update = aggr.aggregate(counter, plan.partials, plan.shards);
          t.set(this.db.doc(plan.aggregate), update, { merge: true });
          // Delete shards that have been aggregated.
          plan.shards.forEach((snap) => t.delete(snap.ref));
          plan.partials.forEach((snap) => t.delete(snap.ref));
        });
        try {
          await Promise.all(promises);
        } catch (err) {
          logger.log("Some counter aggregation failed, bailing out.");
          throw Error("Some counter aggregation failed, bailing out.");
        }
        t.set(
          this.controllerDocRef,
          { timestamp: firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        logger.log("Aggregated " + plans.length + " counters.");
        return ControllerStatus.SUCCESS;
      });
      return status;
    } catch (err) {
      logger.log("Transaction to aggregate shards failed.", err);
      return ControllerStatus.FAILURE;
    }
  }

  /**
   * Reschedule workers based on stats in their metadata docs.
   */
  public async rescheduleWorkers() {
    const timestamp = Date.now();

    await this.db.runTransaction(async (t) => {
      // Read controller document to prevent race conditions.
      try {
        await t.get(this.controllerDocRef);
      } catch (err) {
        logger.log(
          "Failed to read controller doc " + this.controllerDocRef.path
        );
        throw Error("Failed to read controller doc.");
      }
      // Read all workers' metadata and construct sharding info based on collected stats.
      let query: firestore.QuerySnapshot = null;
      try {
        query = await t.get(
          this.workersRef.orderBy(firestore.FieldPath.documentId())
        );
      } catch (err) {
        logger.log("Failed to read worker docs.", err);
        throw Error("Failed to read worker docs.");
      }
      let shardingInfo: WorkerShardingInfo[] = await Promise.all(
        query.docs.map(async (worker) => {
          const slice: Slice = worker.get("slice");
          const stats: WorkerStats = worker.get("stats");
          // This workers hasn't had a chance to finish its run yet. Bail out.
          if (!stats) {
            return {
              slice: slice,
              hasData: false,
              overloaded: false,
              splits: [],
            };
          }

          const hasData = true;
          const overloaded = stats.rounds === stats.roundsCapped;
          const splits = stats.splits;
          // If a worker is overloaded, we don't have reliable splits for that range.
          // Fetch extra shards to make better balancing decision.
          try {
            if (overloaded && splits.length > 0) {
              const snap = await queryRange(
                this.db,
                this.shardCollectionId,
                splits[splits.length - 1],
                slice.end,
                100000
              ).get();
              for (let i = 100; i < snap.docs.length; i += 100) {
                splits.push(snap.docs[i].ref.path);
              }
            }
          } catch (err) {
            logger.log(
              "Failed to calculate additional splits for worker: " + worker.id
            );
          }
          return { slice, hasData, overloaded, splits };
        })
      );

      let [reshard, slices] = ShardedCounterController.balanceWorkers(
        shardingInfo
      );
      if (reshard) {
        logger.log(
          "Resharding workers, new workers: " +
            slices.length +
            " prev num workers: " +
            query.docs.length
        );
        query.docs.forEach((snap) => t.delete(snap.ref));
        slices.forEach((slice, index) => {
          t.set(
            this.workersRef.doc(
              ShardedCounterController.encodeWorkerKey(index)
            ),
            {
              slice: slice,
              timestamp: firestore.FieldValue.serverTimestamp(),
            }
          );
        });
        t.set(this.controllerDocRef, {
          workers: slices,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Check workers that haven't updated stats for over 90s - they most likely failed.
        let failures = 0;
        query.docs.forEach((snap) => {
          if (timestamp / 1000 - snap.updateTime.seconds > 90) {
            t.set(
              snap.ref,
              { timestamp: firestore.FieldValue.serverTimestamp() },
              { merge: true }
            );
            failures++;
          }
        });
        logger.log("Detected " + failures + " failed workers.");
        t.set(
          this.controllerDocRef,
          { timestamp: firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    });
  }

  /**
   * Checks if current workers are imbalanced or overloaded. Returns true and new slices
   * if resharding is required.
   * @param currentWorkers  Sharding info for workers based on their stats
   */
  protected static balanceWorkers(
    currentWorkers: WorkerShardingInfo[]
  ): [boolean, Slice[]] {
    if (currentWorkers.length === 0) {
      return [true, [{ start: "", end: "" }]];
    }
    let splits: string[] = [];
    let reshard = false;
    for (let i = 0; i < currentWorkers.length; i++) {
      let worker = currentWorkers[i];
      // If a worker doesn't have data, it probably hasn't finished yet. Wait for another round
      // since we don't have all the information to rebalance.
      if (!worker.hasData) return [false, []];

      splits.push(worker.slice.start);
      splits = splits.concat(worker.splits || []);
      if (worker.overloaded) reshard = true;

      if (i === currentWorkers.length - 1) {
        splits.push(worker.slice.end);
      }
    }
    if (splits.length < 10 * currentWorkers.length && currentWorkers.length > 1)
      reshard = true;
    if (splits.length <= 2) return [true, []];

    let slices: Slice[] = [];
    for (let i = 0; i < splits.length - 1; i += 20) {
      slices.push({
        start: splits[i],
        end: splits[Math.min(i + 20, splits.length - 1)],
      });
    }
    return [reshard, slices];
  }

  protected static encodeWorkerKey(idx: number): string {
    let key = idx.toString(16);
    while (key.length < 4) key = "0" + key;
    return key;
  }
}

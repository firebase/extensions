"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardedCounterController = exports.ControllerStatus = void 0;
const firebase_admin_1 = require("firebase-admin");
const common_1 = require("./common");
const planner_1 = require("./planner");
const aggregator_1 = require("./aggregator");
const firebase_functions_1 = require("firebase-functions");
const EMPTY_CONTROLLER_DATA = { workers: [], timestamp: 0 };
var ControllerStatus;
(function (ControllerStatus) {
    ControllerStatus[ControllerStatus["WORKERS_RUNNING"] = 0] = "WORKERS_RUNNING";
    ControllerStatus[ControllerStatus["TOO_MANY_SHARDS"] = 1] = "TOO_MANY_SHARDS";
    ControllerStatus[ControllerStatus["SUCCESS"] = 2] = "SUCCESS";
    ControllerStatus[ControllerStatus["FAILURE"] = 3] = "FAILURE";
})(ControllerStatus = exports.ControllerStatus || (exports.ControllerStatus = {}));
/**
 * Controller is run every minute by Cloud Scheduler and monitors health of workers via their
 * metadata documents. If any worker is overloaded or average worker load is below
 * 1000 shards/minute workers will be rebalanced based on their reported stats.
 *
 * Additionally it'll try to aggregate up to 200 shards in-line to avoid starting dedicated
 * workers for low traffic workloads.
 */
class ShardedCounterController {
    constructor(controllerDocRef, shardCollectionId) {
        this.controllerDocRef = controllerDocRef;
        this.shardCollectionId = shardCollectionId;
        if (controllerDocRef) {
            this.workersRef = controllerDocRef.collection("workers");
            this.db = controllerDocRef.firestore;
        }
    }
    /**
     * Try aggregating up to 'limit' shards for a fixed amount of time. If workers
     * are running or there's too many shards, it won't run aggregations at all.
     */
    async aggregateContinuously(slice, limit, timeoutMillis) {
        return new Promise((resolve, reject) => {
            let aggrPromise = null;
            let controllerData = EMPTY_CONTROLLER_DATA;
            let rounds = 0;
            let skippedRoundsDueToWorkers = 0;
            let shardsCount = 0;
            let unsubscribeControllerListener = this.controllerDocRef.onSnapshot((snap) => {
                if (snap.exists) {
                    controllerData = snap.data();
                }
            });
            let unsubscribeSliceListener = common_1.queryRange(this.db, this.shardCollectionId, slice.start, slice.end, limit).onSnapshot(async (snap) => {
                if (snap.docs.length == limit)
                    return;
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
                firebase_functions_1.logger.log("Successfully ran " +
                    rounds +
                    " rounds. Aggregated " +
                    shardsCount +
                    " shards.");
                firebase_functions_1.logger.log("Skipped " +
                    skippedRoundsDueToWorkers +
                    " rounds due to workers running.");
                unsubscribeControllerListener();
                unsubscribeSliceListener();
                if (aggrPromise === null)
                    await aggrPromise;
                resolve();
            };
            setTimeout(shutdown, timeoutMillis);
        });
    }
    /**
     * Try aggregating up to 'limit' shards. If workers are running or there's too many
     * shards return with appropriate status code.
     */
    async aggregateOnce(slice, limit) {
        try {
            const status = await this.db.runTransaction(async (t) => {
                let controllerDoc = null;
                try {
                    controllerDoc = await t.get(this.controllerDocRef);
                }
                catch (err) {
                    firebase_functions_1.logger.log("Failed to read controller doc: " + this.controllerDocRef.path);
                    throw Error("Failed to read controller doc.");
                }
                const controllerData = controllerDoc.exists
                    ? controllerDoc.data()
                    : EMPTY_CONTROLLER_DATA;
                if (controllerData.workers.length > 0)
                    return ControllerStatus.WORKERS_RUNNING;
                let shards = null;
                try {
                    shards = await t.get(common_1.queryRange(this.db, this.shardCollectionId, slice.start, slice.end, limit));
                }
                catch (err) {
                    firebase_functions_1.logger.log("Query to find shards to aggregate failed.", err);
                    throw Error("Query to find shards to aggregate failed.");
                }
                if (shards.docs.length == 200)
                    return ControllerStatus.TOO_MANY_SHARDS;
                const plans = planner_1.Planner.planAggregations("", shards.docs);
                const promises = plans.map(async (plan) => {
                    if (plan.isPartial) {
                        throw Error("Aggregation plan in controller run resulted in partial shard, " +
                            "this should never happen!");
                    }
                    let counter = null;
                    try {
                        counter = await t.get(this.db.doc(plan.aggregate));
                    }
                    catch (err) {
                        firebase_functions_1.logger.log("Failed to read document: " + plan.aggregate, err);
                        throw Error("Failed to read counter " + plan.aggregate);
                    }
                    // Calculate aggregated value and save to aggregate shard.
                    const aggr = new aggregator_1.Aggregator();
                    const update = aggr.aggregate(counter, plan.partials, plan.shards);
                    t.set(this.db.doc(plan.aggregate), update, { merge: true });
                    // Delete shards that have been aggregated.
                    plan.shards.forEach((snap) => t.delete(snap.ref));
                    plan.partials.forEach((snap) => t.delete(snap.ref));
                });
                try {
                    await Promise.all(promises);
                }
                catch (err) {
                    firebase_functions_1.logger.log("Some counter aggregation failed, bailing out.");
                    throw Error("Some counter aggregation failed, bailing out.");
                }
                t.set(this.controllerDocRef, { timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp() }, { merge: true });
                firebase_functions_1.logger.log("Aggregated " + plans.length + " counters.");
                return ControllerStatus.SUCCESS;
            });
            return status;
        }
        catch (err) {
            firebase_functions_1.logger.log("Transaction to aggregate shards failed.", err);
            return ControllerStatus.FAILURE;
        }
    }
    /**
     * Reschedule workers based on stats in their metadata docs.
     */
    async rescheduleWorkers() {
        const timestamp = Date.now();
        await this.db.runTransaction(async (t) => {
            // Read controller document to prevent race conditions.
            try {
                await t.get(this.controllerDocRef);
            }
            catch (err) {
                firebase_functions_1.logger.log("Failed to read controller doc " + this.controllerDocRef.path);
                throw Error("Failed to read controller doc.");
            }
            // Read all workers' metadata and construct sharding info based on collected stats.
            let query = null;
            try {
                query = await t.get(this.workersRef.orderBy(firebase_admin_1.firestore.FieldPath.documentId()));
            }
            catch (err) {
                firebase_functions_1.logger.log("Failed to read worker docs.", err);
                throw Error("Failed to read worker docs.");
            }
            let shardingInfo = await Promise.all(query.docs.map(async (worker) => {
                const slice = worker.get("slice");
                const stats = worker.get("stats");
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
                        const snap = await common_1.queryRange(this.db, this.shardCollectionId, splits[splits.length - 1], slice.end, 100000).get();
                        for (let i = 100; i < snap.docs.length; i += 100) {
                            splits.push(snap.docs[i].ref.path);
                        }
                    }
                }
                catch (err) {
                    firebase_functions_1.logger.log("Failed to calculate additional splits for worker: " + worker.id);
                }
                return { slice, hasData, overloaded, splits };
            }));
            let [reshard, slices] = ShardedCounterController.balanceWorkers(shardingInfo);
            if (reshard) {
                firebase_functions_1.logger.log("Resharding workers, new workers: " +
                    slices.length +
                    " prev num workers: " +
                    query.docs.length);
                query.docs.forEach((snap) => t.delete(snap.ref));
                slices.forEach((slice, index) => {
                    t.set(this.workersRef.doc(ShardedCounterController.encodeWorkerKey(index)), {
                        slice: slice,
                        timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
                    });
                });
                t.set(this.controllerDocRef, {
                    workers: slices,
                    timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
                });
            }
            else {
                // Check workers that haven't updated stats for over 90s - they most likely failed.
                let failures = 0;
                query.docs.forEach((snap) => {
                    if (timestamp / 1000 - snap.updateTime.seconds > 90) {
                        t.set(snap.ref, { timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp() }, { merge: true });
                        failures++;
                    }
                });
                firebase_functions_1.logger.log("Detected " + failures + " failed workers.");
                t.set(this.controllerDocRef, { timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
        });
    }
    /**
     * Checks if current workers are imbalanced or overloaded. Returns true and new slices
     * if resharding is required.
     * @param currentWorkers  Sharding info for workers based on their stats
     */
    static balanceWorkers(currentWorkers) {
        if (currentWorkers.length === 0) {
            return [true, [{ start: "", end: "" }]];
        }
        let splits = [];
        let reshard = false;
        for (let i = 0; i < currentWorkers.length; i++) {
            let worker = currentWorkers[i];
            // If a worker doesn't have data, it probably hasn't finished yet. Wait for another round
            // since we don't have all the information to rebalance.
            if (!worker.hasData)
                return [false, []];
            splits.push(worker.slice.start);
            splits = splits.concat(worker.splits || []);
            if (worker.overloaded)
                reshard = true;
            if (i === currentWorkers.length - 1) {
                splits.push(worker.slice.end);
            }
        }
        if (splits.length < 10 * currentWorkers.length && currentWorkers.length > 1)
            reshard = true;
        if (splits.length <= 2)
            return [true, []];
        let slices = [];
        for (let i = 0; i < splits.length - 1; i += 20) {
            slices.push({
                start: splits[i],
                end: splits[Math.min(i + 20, splits.length - 1)],
            });
        }
        return [reshard, slices];
    }
    static encodeWorkerKey(idx) {
        let key = idx.toString(16);
        while (key.length < 4)
            key = "0" + key;
        return key;
    }
}
exports.ShardedCounterController = ShardedCounterController;

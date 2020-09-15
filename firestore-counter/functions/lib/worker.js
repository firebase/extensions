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
exports.ShardedCounterWorker = void 0;
const firebase_admin_1 = require("firebase-admin");
const deepEqual = require("deep-equal");
const firebase_functions_1 = require("firebase-functions");
const common_1 = require("./common");
const planner_1 = require("./planner");
const aggregator_1 = require("./aggregator");
const uuid = require("uuid");
const SHARDS_LIMIT = 100;
const WORKER_TIMEOUT_MS = 45000;
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
class ShardedCounterWorker {
    constructor(metadoc, shardCollection, singleRun = false) {
        this.metadoc = metadoc;
        this.shardCollection = shardCollection;
        this.singleRun = singleRun;
        // worker state
        this.shards = null;
        this.aggregation = null;
        this.allPaths = [];
        this.rounds = 0;
        this.roundsCapped = 0;
        this.db = metadoc.ref.firestore;
        this.metadata = metadoc.data();
    }
    run() {
        return new Promise((resolve, reject) => {
            let intervalTimer;
            let timeoutTimer;
            let unsubscribeMetadataListener;
            let unsubscribeSliceListener;
            const shutdown = async () => {
                clearInterval(intervalTimer);
                clearTimeout(timeoutTimer);
                unsubscribeMetadataListener();
                unsubscribeSliceListener();
                if (this.aggregation != null) {
                    try {
                        await this.aggregation;
                    }
                    catch (err) {
                        // Not much here we can do, transaction is over.
                    }
                }
            };
            const writeStats = async () => {
                this.allPaths.sort();
                let splits = this.allPaths.filter((val, idx) => idx !== 0 && idx % 100 === 0);
                let stats = {
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
                                    timestamp: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
                                    stats: stats,
                                });
                            }
                        }
                        catch (err) {
                            firebase_functions_1.logger.log("Failed to save writer stats.", err);
                        }
                    });
                }
                catch (err) {
                    firebase_functions_1.logger.log("Failed to save writer stats.", err);
                }
            };
            intervalTimer = setInterval(() => {
                this.maybeAggregate();
            }, 1000);
            timeoutTimer = setTimeout(() => shutdown()
                .then(writeStats)
                .then(resolve)
                .catch(reject), WORKER_TIMEOUT_MS);
            unsubscribeMetadataListener = this.metadoc.ref.onSnapshot((snap) => {
                // if something's changed in the worker metadata since we were called, abort.
                if (!snap.exists || !deepEqual(snap.data(), this.metadata)) {
                    firebase_functions_1.logger.log("Shutting down because metadoc changed.");
                    shutdown()
                        .then(resolve)
                        .catch(reject);
                }
            });
            unsubscribeSliceListener = common_1.queryRange(this.db, this.shardCollection, this.metadata.slice.start, this.metadata.slice.end, SHARDS_LIMIT).onSnapshot((snap) => {
                this.shards = snap.docs;
                if (this.singleRun && this.shards.length === 0) {
                    firebase_functions_1.logger.log("Shutting down, single run mode.");
                    shutdown()
                        .then(writeStats)
                        .then(resolve)
                        .catch(reject);
                }
            });
        });
    }
    maybeAggregate() {
        if (this.aggregation != null || this.shards === null)
            return;
        this.rounds++;
        if (this.shards.length === SHARDS_LIMIT)
            this.roundsCapped++;
        // Identify partial shards that are candidates for cleanup.
        const [toAggregate, toCleanup] = ShardedCounterWorker.categorizeShards(this.shards, this.singleRun);
        const cleanupPromises = ShardedCounterWorker.cleanupPartials(this.db, toCleanup);
        const plans = planner_1.Planner.planAggregations(this.metadata.slice.start, toAggregate);
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
                    const shardsPromise = shardRefs.length > 0
                        ? t.getAll(shardRefs[0], ...shardRefs.slice(1))
                        : Promise.resolve([]);
                    let shards;
                    let counter;
                    let metadoc;
                    try {
                        [shards, counter, metadoc] = await Promise.all([
                            shardsPromise,
                            counterPromise,
                            metadocPromise,
                        ]);
                    }
                    catch (err) {
                        firebase_functions_1.logger.log("Unable to read shards during aggregation round, skipping...", err);
                        return [];
                    }
                    // Check that we still own the slice.
                    if (!metadoc.exists || !deepEqual(metadoc.data(), this.metadata)) {
                        firebase_functions_1.logger.log("Metadata has changed, bailing out...");
                        return [];
                    }
                    // Calculate aggregated value and save to aggregate shard.
                    const aggr = new aggregator_1.Aggregator();
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
            }
            catch (err) {
                firebase_functions_1.logger.log("transaction to: " + plan.aggregate + " failed, skipping...", err);
            }
        });
        if (promises.length === 0 && cleanupPromises.length === 0)
            return;
        this.aggregation = Promise.all(promises.concat(cleanupPromises)).then(() => {
            // once this aggregation is done mark it as such
            this.aggregation = null;
            return;
        });
    }
    //TODO increase test coverage
    static categorizeShards(shards, singleRun) {
        const toAggregate = [];
        const toCleanup = [];
        shards.forEach((shard) => {
            // Don't aggregate empty partials, instead consider them for cleanup.
            if (shard.exists && isEmptyPartial(shard.data())) {
                if (!common_1.isUpdatedFrequently(shard) || singleRun)
                    toCleanup.push(shard);
                return;
            }
            // Partials that have many updates should be cleaned up (i.e. compacted), but need to be aggregated as well.
            if (shard.exists && common_1.containsManyUpdates(shard)) {
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
    static cleanupPartials(db, toCleanup) {
        return toCleanup.map(async (partial) => {
            try {
                await db.runTransaction(async (t) => {
                    try {
                        const snap = await t.get(partial.ref);
                        if (snap.exists && isEmptyPartial(snap.data())) {
                            t.delete(snap.ref);
                        }
                        else if (snap.exists) {
                            const update = new aggregator_1.NumericUpdate();
                            const data = snap.data();
                            if ("_updates_" in data) {
                                data["_updates_"].forEach((u) => {
                                    update.mergeFrom(u["_data_"]);
                                });
                            }
                            t.set(snap.ref, update.toPartialShard(() => uuid.v4()));
                        }
                    }
                    catch (err) {
                        firebase_functions_1.logger.log("Partial cleanup failed: " + partial.ref.path);
                    }
                });
            }
            catch (err) {
                firebase_functions_1.logger.log("transaction to delete: " + partial.ref.path + " failed, skipping", err);
            }
        });
    }
}
exports.ShardedCounterWorker = ShardedCounterWorker;
function isEmptyPartial(data) {
    // Check if this is a partial at all
    if (Object.keys(data).length > 1)
        return false;
    if (Object.keys(data).length === 1 && !("_updates_" in data))
        return false;
    if (Object.keys(data).length === 0)
        return true;
    const update = new aggregator_1.NumericUpdate();
    data["_updates_"].forEach((u) => {
        update.mergeFrom(u["_data_"]);
    });
    return update.isNoop();
}

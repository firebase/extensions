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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const worker_1 = require("./worker");
const controller_1 = require("./controller");
admin.initializeApp();
const firestore = admin.firestore();
firestore.settings({ timestampsInSnapshots: true });
const SHARDS_COLLECTION_ID = "_counter_shards_";
const WORKERS_COLLECTION_ID = "_counter_workers_";
/**
 * Controller is scheduled every minute. It tries to aggregate shards if
 * there's less than 200 of them. Otherwise it is scheduling and monitoring
 * workers to do the aggregation.
 */
exports.controller = functions.https.onRequest((req, res) => __awaiter(this, void 0, void 0, function* () {
    const metadocRef = firestore.doc(process.env.MOD_METADATA_DOC);
    const controller = new controller_1.ShardedCounterController(metadocRef, SHARDS_COLLECTION_ID);
    let status = yield controller.aggregateOnce({ start: "", end: "" }, 200);
    if (status === controller_1.ControllerStatus.WORKERS_RUNNING ||
        status === controller_1.ControllerStatus.TOO_MANY_SHARDS ||
        status === controller_1.ControllerStatus.FAILURE) {
        yield controller.rescheduleWorkers();
    }
    res.status(200).send("OK");
}));
/**
 * Worker is responsible for aggregation of a defined range of shards. It is controlled
 * by a worker metadata document. At the end of its run (that lasts for 45s) it writes
 * back stats that kicks off another run at the same time.
 *
 * Controller is monitoring these metadata documents to detect overload that requires
 * resharding and to detect failed workers that need poking.
 */
exports.worker = functions.firestore
    .document(process.env.MOD_METADATA_DOC + WORKERS_COLLECTION_ID + "/{workerId}")
    .onWrite((change, context) => __awaiter(this, void 0, void 0, function* () {
    // stop worker if document got deleted
    if (!change.after.exists)
        return;
    const worker = new worker_1.ShardedCounterWorker(change.after, SHARDS_COLLECTION_ID);
    yield worker.run();
}));
/**
 * This is an additional function that is triggered for every shard write. It is
 * limited to one concurrent run at the time. This helps reduce latency for workloads
 * that are below the theshold for workers.
 */
exports.onWrite = functions.firestore
    .document("/{collection}/{**}/_counter_shards_/{shardId}")
    .onWrite((change, context) => __awaiter(this, void 0, void 0, function* () {
    const metadocRef = firestore.doc(process.env.MOD_METADATA_DOC);
    const controller = new controller_1.ShardedCounterController(metadocRef, SHARDS_COLLECTION_ID);
    yield controller.aggregateContinuously({ start: "", end: "" }, 200, 60000);
}));

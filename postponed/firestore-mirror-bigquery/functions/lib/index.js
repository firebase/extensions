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
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const bigquery_1 = require("./bigquery");
const config_1 = require("./config");
const firestore_1 = require("./firestore");
const firestoreEventHistoryTracker_1 = require("./firestoreEventHistoryTracker");
const logs = require("./logs");
const util_1 = require("./util");
// TODO: How can we load a file dynamically?
const schemaFile = require("../schema.json");
let eventTracker = new bigquery_1.FirestoreBigQueryEventHistoryTracker(config_1.default);
logs.init();
exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite((change, context) => __awaiter(void 0, void 0, void 0, function* () {
    logs.start();
    try {
        // @ts-ignore string not assignable to enum
        const schema = schemaFile;
        const { fields, timestampField } = schema;
        // Identify the operation and data to be inserted
        let data;
        let defaultTimestamp;
        let snapshot;
        let operation;
        const changeType = getChangeType(change);
        switch (changeType) {
            case firestoreEventHistoryTracker_1.ChangeType.INSERT:
                operation = "INSERT";
                snapshot = change.after;
                data = firestore_1.extractSnapshotData(snapshot, fields);
                defaultTimestamp = snapshot.createTime
                    ? snapshot.createTime.toDate().toISOString()
                    : context.timestamp;
                break;
            case firestoreEventHistoryTracker_1.ChangeType.DELETE:
                operation = "DELETE";
                snapshot = change.before;
                data = firestore_1.extractSnapshotData(snapshot, fields);
                defaultTimestamp = context.timestamp;
                break;
            case firestoreEventHistoryTracker_1.ChangeType.UPDATE:
                operation = "UPDATE";
                snapshot = change.after;
                data = firestore_1.extractSnapshotData(snapshot, fields);
                defaultTimestamp = snapshot.updateTime
                    ? snapshot.updateTime.toDate().toISOString()
                    : context.timestamp;
                break;
            default: {
                throw new Error(`Invalid change type: ${changeType}`);
            }
        }
        const timestamp = util_1.extractTimestamp(data, defaultTimestamp, timestampField);
        yield eventTracker.record([{
                timestamp: timestamp,
                operation: changeType,
                name: context.resource.name,
                documentId: snapshot.ref.id,
                eventId: context.eventId,
                data: data
            }]);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
function getChangeType(change) {
    if (!change.after.exists) {
        return firestoreEventHistoryTracker_1.ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return firestoreEventHistoryTracker_1.ChangeType.INSERT;
    }
    return firestoreEventHistoryTracker_1.ChangeType.UPDATE;
}
;

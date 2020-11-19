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
const config_1 = require("./config");
const functions = require("firebase-functions");
const firestore_bigquery_change_tracker_1 = require("@firebaseextensions/firestore-bigquery-change-tracker");
const logs = require("./logs");
const util_1 = require("./util");
const eventTracker = new firestore_bigquery_change_tracker_1.FirestoreBigQueryEventHistoryTracker({
    tableId: config_1.default.tableId,
    datasetId: config_1.default.datasetId,
    datasetLocation: config_1.default.datasetLocation,
});
logs.init();
exports.fsexportbigquery = functions.handler.firestore.document.onWrite(async (change, context) => {
    logs.start();
    try {
        const changeType = util_1.getChangeType(change);
        const documentId = util_1.getDocumentId(change);
        await eventTracker.record([
            {
                timestamp: context.timestamp,
                operation: changeType,
                documentName: context.resource.name,
                documentId: documentId,
                eventId: context.eventId,
                data: changeType === firestore_bigquery_change_tracker_1.ChangeType.DELETE ? undefined : change.after.data(),
            },
        ]);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
});

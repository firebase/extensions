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
const bigquery_1 = require("./bigquery");
const config_1 = require("./config");
const firestore_1 = require("./firestore");
const logs = require("./logs");
const util_1 = require("./util");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (ChangeType = {}));
// TODO: How can we load a file dynamically?
const schemaFile = require("../schema.json");
// Flag to indicate if the BigQuery schema has been initialized.
// This is a work around to prevent the need to run the initialization on every
// function execution and instead restricts the initialization to cold starts
// of the function.
let isSchemainitialized = false;
logs.init();
exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite((change, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        // @ts-ignore string not assignable to enum
        const schema = schemaFile;
        const { fields, timestampField } = schema;
        // Is the collection path for a sub-collection and does the collection path
        // contain any wildcard parameters
        // NOTE: This is a workaround as `context.params` is not available in the
        // `.handler` namespace
        const idFieldNames = util_1.extractIdFieldNames(config_1.default.collectionPath);
        // This initialization should be moved to `mod install` if Mods adds support
        // for executing code as part of the install process
        // Currently it runs on every cold start of the function
        if (!isSchemainitialized) {
            yield bigquery_1.initializeSchema(config_1.default.datasetId, config_1.default.tableName, schema, idFieldNames);
            isSchemainitialized = true;
        }
        // Identify the operation and data to be inserted
        let data;
        let defaultTimestamp;
        let snapshot;
        let operation;
        const changeType = getChangeType(change);
        switch (changeType) {
            case ChangeType.CREATE:
                operation = "INSERT";
                snapshot = change.after;
                data = firestore_1.extractSnapshotData(snapshot, fields);
                defaultTimestamp = snapshot.createTime
                    ? snapshot.createTime.toDate().toISOString()
                    : context.timestamp;
                break;
            case ChangeType.DELETE:
                operation = "DELETE";
                snapshot = change.before;
                defaultTimestamp = context.timestamp;
                break;
            case ChangeType.UPDATE:
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
        // Extract the values of any `idFieldNames` specifed in the collection path
        const { idFieldValues } = util_1.extractIdFieldValues(snapshot, idFieldNames);
        // Extract the timestamp, or use either the snapshot metadata or the event timestamp as a default
        const timestamp = util_1.extractTimestamp(data, defaultTimestamp, timestampField);
        // Build the row of data to insert into BigQuery
        const row = bigquery_1.buildDataRow(idFieldValues, 
        // Use the function's event ID to protect against duplicate executions
        context.eventId, operation, timestamp, data);
        yield bigquery_1.insertData(config_1.default.datasetId, config_1.default.tableName, row);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
const getChangeType = (change) => {
    if (!change.after.exists) {
        return ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
};

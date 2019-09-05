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
const bigquery = require("@google-cloud/bigquery");
const schema_1 = require("./schema");
const firestoreEventHistoryTracker_1 = require("../firestoreEventHistoryTracker");
const logs = require("../logs");
class FirestoreBigQueryEventHistoryTracker {
    constructor(config) {
        this.config = config;
        this.bq = new bigquery.BigQuery();
        this.schemaInitialized = config.schemaInitialized;
    }
    record(events) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.config.schemaInitialized) {
                yield this.initialize(this.config.datasetId, this.config.tableName);
                this.schemaInitialized = true;
            }
            const rows = events.map(event => {
                return this.buildDataRow(
                // Use the function's event ID to protect against duplicate executions
                event.eventId, event.operation, event.timestamp, event.name, event.documentId, event.data);
            });
            yield this.insertData(this.config.datasetId, this.config.tableName, rows);
        });
    }
    /**
     * Ensure that the defined Firestore schema exists within BigQuery and
     * contains the correct information.
     *
     *
     * NOTE: This currently gets executed on every cold start of the function.
     * Ideally this would run once when the mod is installed if that were
     * possible in the future.
     */
    initialize(datasetId, tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            logs.bigQuerySchemaInitializing();
            const realTableName = rawTableName(tableName);
            yield this.initializeDataset(datasetId);
            yield this.initializeTable(datasetId, realTableName);
            yield this.initializeLatestView(datasetId, realTableName);
            logs.bigQuerySchemaInitialized();
        });
    }
    ;
    buildDataRow(eventId, changeType, timestamp, key, id, data) {
        return {
            timestamp,
            eventId,
            key: key,
            id,
            operation: firestoreEventHistoryTracker_1.ChangeType[changeType],
            data: JSON.stringify(data)
        };
    }
    ;
    /**
     * Insert a row of data into the BigQuery `raw` data table
     */
    insertData(datasetId, tableName, rows) {
        return __awaiter(this, void 0, void 0, function* () {
            const realTableName = rawTableName(tableName);
            const dataset = this.bq.dataset(datasetId);
            const table = dataset.table(realTableName);
            const rowCount = rows.length;
            logs.dataInserting(rowCount);
            yield table.insert(rows);
            logs.dataInserted(rowCount);
        });
    }
    ;
    /**
     * Check that the specified dataset exists, and create it if it doesn't.
     */
    initializeDataset(datasetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataset = this.bq.dataset(datasetId);
            const [datasetExists] = yield dataset.exists();
            if (datasetExists) {
                logs.bigQueryDatasetExists(datasetId);
            }
            else {
                logs.bigQueryDatasetCreating(datasetId);
                yield dataset.create();
                logs.bigQueryDatasetCreated(datasetId);
            }
            return dataset;
        });
    }
    ;
    /**
     * Check that the table exists within the specified dataset, and create it
     * if it doesn't.  If the table does exist, validate that the BigQuery schema
     * is correct and add any missing fields.
     */
    initializeTable(datasetId, tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataset = this.bq.dataset(datasetId);
            let table = dataset.table(tableName);
            const [tableExists] = yield table.exists();
            if (!tableExists) {
                logs.bigQueryTableCreating(tableName);
                const options = {
                    // `friendlyName` needs to be here to satisfy TypeScript
                    friendlyName: tableName,
                    schema: schema_1.firestoreToBQTable(),
                };
                yield table.create(options);
                logs.bigQueryTableCreated(tableName);
            }
            return table;
        });
    }
    ;
    /**
     * Create a view over a table storing a change log of Firestore documents
     * which contains only latest version of all live documents in the mirrored
     * collection.
     * @param datasetId
     * @param tableName
     */
    initializeLatestView(datasetId, tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            let viewName = latestViewName(tableName);
            const dataset = this.bq.dataset(datasetId);
            let view = dataset.table(viewName);
            const [viewExists] = yield view.exists();
            if (!viewExists) {
                logs.bigQueryViewCreating(viewName);
                const options = {
                    friendlyName: viewName,
                    view: schema_1.latestConsistentSnapshotView(datasetId, tableName)
                };
                yield view.create(options);
                logs.bigQueryViewCreated(viewName);
            }
            return view;
        });
    }
    ;
}
exports.FirestoreBigQueryEventHistoryTracker = FirestoreBigQueryEventHistoryTracker;
function rawTableName(tableName) { return `${tableName}_raw`; }
;
function latestViewName(tableName) { return `${tableName}_latest`; }
;

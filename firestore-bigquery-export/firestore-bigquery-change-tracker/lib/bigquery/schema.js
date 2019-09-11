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
const bigQueryField = (name, type, mode, fields) => ({
    fields,
    mode: mode || "NULLABLE",
    name,
    type,
});
// These field types form the basis of the `raw` data table
exports.dataField = bigQueryField("data", "STRING", "NULLABLE");
exports.documentNameField = bigQueryField("document_name", "STRING", "REQUIRED");
exports.eventIdField = bigQueryField("event_id", "STRING", "REQUIRED");
exports.operationField = bigQueryField("operation", "STRING", "REQUIRED");
exports.timestampField = bigQueryField("timestamp", "TIMESTAMP", "REQUIRED");
// These field types are used for the Firestore GeoPoint data type
exports.latitudeField = bigQueryField("latitude", "NUMERIC");
exports.longitudeField = bigQueryField("longitude", "NUMERIC");
/**
 * Convert from a list of Firestore field definitions into the schema
 * that will be used by the BigQuery `raw` data table.
 *
 * The `raw` data table schema is:
 * - event_id: The event ID of the function trigger invocation responsible for
 *   the row
 * - timestamp: A timestamp to be used for update ordering
 * - documentName: Stores the name of the Firestore document
 * - operation: The type of operation: CREATE, UPDATE, DELETE
 * - data: A record to contain the Firestore document data fields specified
 * in the schema
 */
exports.firestoreToBQTable = () => [
    exports.timestampField,
    exports.eventIdField,
    exports.documentNameField,
    exports.operationField,
    exports.dataField
];

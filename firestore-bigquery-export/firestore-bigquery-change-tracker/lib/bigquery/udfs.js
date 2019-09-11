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
const sqlFormatter = require("sql-formatter");
// Persistent UDFS to be created on schema view initialization.
exports.udfs = {
    "firestoreArray": firestoreArrayFunction,
    "firestoreBoolean": firestoreBooleanFunction,
    "firestoreNumber": firestoreNumberFunction,
    "firestoreTimestamp": firestoreTimestampFunction,
    "firestoreGeopoint": firestoreGeopointFunction,
};
function firestoreArray(datasetId, selector) {
    return (`\`${process.env.PROJECT_ID}.${datasetId}.firestoreArray\`(${selector})`);
}
exports.firestoreArray = firestoreArray;
function firestoreBoolean(datasetId, selector) {
    return (`\`${process.env.PROJECT_ID}.${datasetId}.firestoreBoolean\`(${selector})`);
}
exports.firestoreBoolean = firestoreBoolean;
function firestoreNumber(datasetId, selector) {
    return (`\`${process.env.PROJECT_ID}.${datasetId}.firestoreNumber\`(${selector})`);
}
exports.firestoreNumber = firestoreNumber;
function firestoreTimestamp(datasetId, selector) {
    return (`\`${process.env.PROJECT_ID}.${datasetId}.firestoreTimestamp\`(${selector})`);
}
exports.firestoreTimestamp = firestoreTimestamp;
function firestoreGeopoint(datasetId, selector) {
    return (`\`${process.env.PROJECT_ID}.${datasetId}.firestoreGeopoint\`(${selector})`);
}
exports.firestoreGeopoint = firestoreGeopoint;
function firestoreArrayFunction(datasetId) {
    const definition = firestoreArrayDefinition(datasetId);
    return ({
        query: definition,
        useLegacySql: false
    });
}
function firestoreArrayDefinition(datasetId) {
    return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.firestoreArray\`(json STRING)
    RETURNS ARRAY<STRING>
    LANGUAGE js AS """
      return json ? JSON.parse(json).map(x => JSON.stringify(x)) : [];
    """;`);
}
function firestoreBooleanFunction(datasetId) {
    const definition = firestoreBooleanDefinition(datasetId);
    return ({
        query: definition,
        useLegacySql: false
    });
}
function firestoreBooleanDefinition(datasetId) {
    return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.firestoreBoolean\`(json STRING)
    RETURNS BOOLEAN AS (SAFE_CAST(json AS BOOLEAN));`);
}
function firestoreNumberFunction(datasetId) {
    const definition = firestoreNumberDefinition(datasetId);
    return ({
        query: definition,
        useLegacySql: false
    });
}
function firestoreNumberDefinition(datasetId) {
    return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.firestoreNumber\`(json STRING)
    RETURNS NUMERIC AS (SAFE_CAST(json AS NUMERIC));`);
}
function firestoreTimestampFunction(datasetId) {
    const definition = firestoreTimestampDefinition(datasetId);
    return ({
        query: definition,
        useLegacySql: false
    });
}
function firestoreTimestampDefinition(datasetId) {
    return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.firestoreTimestamp\`(json STRING)
    RETURNS TIMESTAMP AS
    (TIMESTAMP_MILLIS(SAFE_CAST(JSON_EXTRACT(json, '$._seconds') AS INT64) * 1000 + SAFE_CAST(SAFE_CAST(JSON_EXTRACT(json, '$._nanoseconds') AS INT64) / 1E6 AS INT64)));`);
}
function firestoreGeopointFunction(datasetId) {
    const definition = firestoreGeopointDefinition(datasetId);
    return ({
        query: definition,
        useLegacySql: false
    });
}
function firestoreGeopointDefinition(datasetId) {
    return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.firestoreGeopoint\`(json STRING)
    RETURNS GEOGRAPHY AS
    (ST_GEOGPOINT(SAFE_CAST(JSON_EXTRACT(json, '$._latitude') AS NUMERIC), SAFE_CAST(JSON_EXTRACT(json, '$._longitude') AS NUMERIC)));`);
}

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
exports.timestampMissingValue = exports.start = exports.init = exports.error = exports.dataTypeInvalid = exports.dataInserting = exports.dataInserted = exports.complete = exports.bigQueryViewValidating = exports.bigQueryViewValidated = exports.bigQueryViewUpToDate = exports.bigQueryViewUpdating = exports.bigQueryViewUpdated = exports.bigQueryViewAlreadyExists = exports.bigQueryViewCreating = exports.bigQueryViewCreated = exports.bigQueryUserDefinedFunctionCreated = exports.bigQueryUserDefinedFunctionCreating = exports.bigQueryTableValidating = exports.bigQueryTableValidated = exports.bigQueryTableUpToDate = exports.bigQueryTableUpdating = exports.bigQueryTableUpdated = exports.bigQueryTableCreating = exports.bigQueryTableCreated = exports.bigQueryTableAlreadyExists = exports.bigQueryLatestSnapshotViewQueryCreated = exports.bigQueryErrorRecordingDocumentChange = exports.bigQueryDatasetExists = exports.bigQueryDatasetCreating = exports.bigQueryDatasetCreated = exports.arrayFieldInvalid = void 0;
const config_1 = require("./config");
exports.arrayFieldInvalid = (fieldName) => {
    console.warn(`Array field '${fieldName}' does not contain an array, skipping`);
};
exports.bigQueryDatasetCreated = (datasetId) => {
    console.log(`Created BigQuery dataset: ${datasetId}`);
};
exports.bigQueryDatasetCreating = (datasetId) => {
    console.log(`Creating BigQuery dataset: ${datasetId}`);
};
exports.bigQueryDatasetExists = (datasetId) => {
    console.log(`BigQuery dataset already exists: ${datasetId}`);
};
exports.bigQueryErrorRecordingDocumentChange = (e) => {
    console.error(`Error recording document changes.`, e);
};
exports.bigQueryLatestSnapshotViewQueryCreated = (query) => {
    console.log(`BigQuery latest snapshot view query:\n${query}`);
};
exports.bigQueryTableAlreadyExists = (tableName, datasetName) => {
    console.log(`BigQuery table with name ${tableName} already ` +
        `exists in dataset ${datasetName}!`);
};
exports.bigQueryTableCreated = (tableName) => {
    console.log(`Created BigQuery table: ${tableName}`);
};
exports.bigQueryTableCreating = (tableName) => {
    console.log(`Creating BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpdated = (tableName) => {
    console.log(`Updated existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpdating = (tableName) => {
    console.log(`Updating existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpToDate = (tableName) => {
    console.log(`BigQuery table: ${tableName} is up to date`);
};
exports.bigQueryTableValidated = (tableName) => {
    console.log(`Validated existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableValidating = (tableName) => {
    console.log(`Validating existing BigQuery table: ${tableName}`);
};
exports.bigQueryUserDefinedFunctionCreating = (functionDefinition) => {
    console.log(`Creating BigQuery User-defined Function:\n${functionDefinition}`);
};
exports.bigQueryUserDefinedFunctionCreated = (functionDefinition) => {
    console.log(`Created BigQuery User-defined Function:\n${functionDefinition}`);
};
exports.bigQueryViewCreated = (viewName) => {
    console.log(`Created BigQuery view: ${viewName}`);
};
exports.bigQueryViewCreating = (viewName) => {
    console.log(`Creating BigQuery view: ${viewName}`);
};
exports.bigQueryViewAlreadyExists = (viewName, datasetName) => {
    console.log(`View with id ${viewName} already exists in dataset ${datasetName}.`);
};
exports.bigQueryViewUpdated = (viewName) => {
    console.log(`Updated existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewUpdating = (viewName) => {
    console.log(`Updating existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewUpToDate = (viewName) => {
    console.log(`BigQuery view: ${viewName} is up to date`);
};
exports.bigQueryViewValidated = (viewName) => {
    console.log(`Validated existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewValidating = (viewName) => {
    console.log(`Validating existing BigQuery view: ${viewName}`);
};
exports.complete = () => {
    console.log("Completed execution of extension");
};
exports.dataInserted = (rowCount) => {
    console.log(`Inserted ${rowCount} row(s) of data into BigQuery`);
};
exports.dataInserting = (rowCount) => {
    console.log(`Inserting ${rowCount} row(s) of data into BigQuery`);
};
exports.dataTypeInvalid = (fieldName, fieldType, dataType) => {
    console.warn(`Field '${fieldName}' has invalid data. Expected: ${fieldType}, received: ${dataType}`);
};
exports.error = (err) => {
    console.error("Error when mirroring data to BigQuery", err);
};
exports.init = () => {
    console.log("Initializing extension with configuration", config_1.default);
};
exports.start = () => {
    console.log("Started execution of extension with configuration", config_1.default);
};
exports.timestampMissingValue = (fieldName) => {
    console.warn(`Missing value for timestamp field: ${fieldName}, using default timestamp instead.`);
};

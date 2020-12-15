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
const configurableConsole = {
    ...console,
    log: config_1.default.logInfo ? console.log : () => { }
};
exports.arrayFieldInvalid = (fieldName) => {
    configurableConsole.warn(`Array field '${fieldName}' does not contain an array, skipping`);
};
exports.bigQueryDatasetCreated = (datasetId) => {
    configurableConsole.log(`Created BigQuery dataset: ${datasetId}`);
};
exports.bigQueryDatasetCreating = (datasetId) => {
    configurableConsole.log(`Creating BigQuery dataset: ${datasetId}`);
};
exports.bigQueryDatasetExists = (datasetId) => {
    configurableConsole.log(`BigQuery dataset already exists: ${datasetId}`);
};
exports.bigQueryErrorRecordingDocumentChange = (e) => {
    configurableConsole.error(`Error recording document changes.`, e);
};
exports.bigQueryLatestSnapshotViewQueryCreated = (query) => {
    configurableConsole.log(`BigQuery latest snapshot view query:\n${query}`);
};
exports.bigQueryTableAlreadyExists = (tableName, datasetName) => {
    configurableConsole.log(`BigQuery table with name ${tableName} already ` +
        `exists in dataset ${datasetName}!`);
};
exports.bigQueryTableCreated = (tableName) => {
    configurableConsole.log(`Created BigQuery table: ${tableName}`);
};
exports.bigQueryTableCreating = (tableName) => {
    configurableConsole.log(`Creating BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpdated = (tableName) => {
    configurableConsole.log(`Updated existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpdating = (tableName) => {
    configurableConsole.log(`Updating existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableUpToDate = (tableName) => {
    configurableConsole.log(`BigQuery table: ${tableName} is up to date`);
};
exports.bigQueryTableValidated = (tableName) => {
    configurableConsole.log(`Validated existing BigQuery table: ${tableName}`);
};
exports.bigQueryTableValidating = (tableName) => {
    configurableConsole.log(`Validating existing BigQuery table: ${tableName}`);
};
exports.bigQueryUserDefinedFunctionCreating = (functionDefinition) => {
    configurableConsole.log(`Creating BigQuery User-defined Function:\n${functionDefinition}`);
};
exports.bigQueryUserDefinedFunctionCreated = (functionDefinition) => {
    configurableConsole.log(`Created BigQuery User-defined Function:\n${functionDefinition}`);
};
exports.bigQueryViewCreated = (viewName) => {
    configurableConsole.log(`Created BigQuery view: ${viewName}`);
};
exports.bigQueryViewCreating = (viewName) => {
    configurableConsole.log(`Creating BigQuery view: ${viewName}`);
};
exports.bigQueryViewAlreadyExists = (viewName, datasetName) => {
    configurableConsole.log(`View with id ${viewName} already exists in dataset ${datasetName}.`);
};
exports.bigQueryViewUpdated = (viewName) => {
    configurableConsole.log(`Updated existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewUpdating = (viewName) => {
    configurableConsole.log(`Updating existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewUpToDate = (viewName) => {
    configurableConsole.log(`BigQuery view: ${viewName} is up to date`);
};
exports.bigQueryViewValidated = (viewName) => {
    configurableConsole.log(`Validated existing BigQuery view: ${viewName}`);
};
exports.bigQueryViewValidating = (viewName) => {
    configurableConsole.log(`Validating existing BigQuery view: ${viewName}`);
};
exports.complete = () => {
    configurableConsole.log("Completed execution of extension");
};
exports.dataInserted = (rowCount) => {
    configurableConsole.log(`Inserted ${rowCount} row(s) of data into BigQuery`);
};
exports.dataInserting = (rowCount) => {
    configurableConsole.log(`Inserting ${rowCount} row(s) of data into BigQuery`);
};
exports.dataTypeInvalid = (fieldName, fieldType, dataType) => {
    configurableConsole.warn(`Field '${fieldName}' has invalid data. Expected: ${fieldType}, received: ${dataType}`);
};
exports.error = (err) => {
    configurableConsole.error("Error when mirroring data to BigQuery", err);
};
exports.init = () => {
    configurableConsole.log("Initializing extension with configuration", config_1.default);
};
exports.start = () => {
    configurableConsole.log("Started execution of extension with configuration", config_1.default);
};
exports.timestampMissingValue = (fieldName) => {
    configurableConsole.warn(`Missing value for timestamp field: ${fieldName}, using default timestamp instead.`);
};

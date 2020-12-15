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

import config from "./config";

const configurableConsole = {
  ...console,
  log: config.logInfo ? console.log : () => {},
};

export const arrayFieldInvalid = (fieldName: string) => {
  configurableConsole.warn(
    `Array field '${fieldName}' does not contain an array, skipping`
  );
};

export const bigQueryDatasetCreated = (datasetId: string) => {
  configurableConsole.log(`Created BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetCreating = (datasetId: string) => {
  configurableConsole.log(`Creating BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetExists = (datasetId: string) => {
  configurableConsole.log(`BigQuery dataset already exists: ${datasetId}`);
};

export const bigQueryErrorRecordingDocumentChange = (e: Error) => {
  configurableConsole.error(`Error recording document changes.`, e);
};

export const bigQueryLatestSnapshotViewQueryCreated = (query: string) => {
  configurableConsole.log(`BigQuery latest snapshot view query:\n${query}`);
};

export const bigQueryTableAlreadyExists = (
  tableName: string,
  datasetName: string
) => {
  configurableConsole.log(
    `BigQuery table with name ${tableName} already ` +
      `exists in dataset ${datasetName}!`
  );
};

export const bigQueryTableCreated = (tableName: string) => {
  configurableConsole.log(`Created BigQuery table: ${tableName}`);
};

export const bigQueryTableCreating = (tableName: string) => {
  configurableConsole.log(`Creating BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdated = (tableName: string) => {
  configurableConsole.log(`Updated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdating = (tableName: string) => {
  configurableConsole.log(`Updating existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpToDate = (tableName: string) => {
  configurableConsole.log(`BigQuery table: ${tableName} is up to date`);
};

export const bigQueryTableValidated = (tableName: string) => {
  configurableConsole.log(`Validated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableValidating = (tableName: string) => {
  configurableConsole.log(`Validating existing BigQuery table: ${tableName}`);
};

export const bigQueryUserDefinedFunctionCreating = (
  functionDefinition: string
) => {
  configurableConsole.log(
    `Creating BigQuery User-defined Function:\n${functionDefinition}`
  );
};

export const bigQueryUserDefinedFunctionCreated = (
  functionDefinition: string
) => {
  configurableConsole.log(
    `Created BigQuery User-defined Function:\n${functionDefinition}`
  );
};

export const bigQueryViewCreated = (viewName: string) => {
  configurableConsole.log(`Created BigQuery view: ${viewName}`);
};

export const bigQueryViewCreating = (viewName: string) => {
  configurableConsole.log(`Creating BigQuery view: ${viewName}`);
};

export const bigQueryViewAlreadyExists = (
  viewName: string,
  datasetName: string
) => {
  configurableConsole.log(
    `View with id ${viewName} already exists in dataset ${datasetName}.`
  );
};

export const bigQueryViewUpdated = (viewName: string) => {
  configurableConsole.log(`Updated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpdating = (viewName: string) => {
  configurableConsole.log(`Updating existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpToDate = (viewName: string) => {
  configurableConsole.log(`BigQuery view: ${viewName} is up to date`);
};

export const bigQueryViewValidated = (viewName: string) => {
  configurableConsole.log(`Validated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewValidating = (viewName: string) => {
  configurableConsole.log(`Validating existing BigQuery view: ${viewName}`);
};

export const complete = () => {
  configurableConsole.log("Completed execution of extension");
};

export const dataInserted = (rowCount: number) => {
  configurableConsole.log(`Inserted ${rowCount} row(s) of data into BigQuery`);
};

export const dataInserting = (rowCount: number) => {
  configurableConsole.log(`Inserting ${rowCount} row(s) of data into BigQuery`);
};

export const dataTypeInvalid = (
  fieldName: string,
  fieldType: string,
  dataType: string
) => {
  configurableConsole.warn(
    `Field '${fieldName}' has invalid data. Expected: ${fieldType}, received: ${dataType}`
  );
};

export const error = (err: Error) => {
  configurableConsole.error("Error when mirroring data to BigQuery", err);
};

export const init = () => {
  configurableConsole.log("Initializing extension with configuration", config);
};

export const start = () => {
  configurableConsole.log(
    "Started execution of extension with configuration",
    config
  );
};

export const timestampMissingValue = (fieldName: string) => {
  configurableConsole.warn(
    `Missing value for timestamp field: ${fieldName}, using default timestamp instead.`
  );
};

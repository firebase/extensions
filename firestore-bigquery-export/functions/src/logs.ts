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
import { logger } from "firebase-functions";
import config from "./config";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";

export const arrayFieldInvalid = (fieldName: string) => {
  logger.warn(`Array field '${fieldName}' does not contain an array, skipping`);
};

export const bigQueryDatasetCreated = (datasetId: string) => {
  logger.log(`Created BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetCreating = (datasetId: string) => {
  logger.log(`Creating BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetExists = (datasetId: string) => {
  logger.log(`BigQuery dataset already exists: ${datasetId}`);
};

export const bigQueryErrorRecordingDocumentChange = (e: Error) => {
  logger.error(`Error recording document changes.`, e);
};

export const bigQueryLatestSnapshotViewQueryCreated = (query: string) => {
  logger.log(`BigQuery latest snapshot view query:\n${query}`);
};

export const bigQueryTableAlreadyExists = (
  tableName: string,
  datasetName: string
) => {
  logger.log(
    `BigQuery table with name ${tableName} already ` +
      `exists in dataset ${datasetName}!`
  );
};

export const bigQueryTableCreated = (tableName: string) => {
  logger.log(`Created BigQuery table: ${tableName}`);
};

export const bigQueryTableCreating = (tableName: string) => {
  logger.log(`Creating BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdated = (tableName: string) => {
  logger.log(`Updated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdating = (tableName: string) => {
  logger.log(`Updating existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpToDate = (tableName: string) => {
  logger.log(`BigQuery table: ${tableName} is up to date`);
};

export const bigQueryTableValidated = (tableName: string) => {
  logger.log(`Validated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableValidating = (tableName: string) => {
  logger.log(`Validating existing BigQuery table: ${tableName}`);
};

export const bigQueryUserDefinedFunctionCreating = (
  functionDefinition: string
) => {
  logger.log(`Creating BigQuery User-defined Function:\n${functionDefinition}`);
};

export const bigQueryUserDefinedFunctionCreated = (
  functionDefinition: string
) => {
  logger.log(`Created BigQuery User-defined Function:\n${functionDefinition}`);
};

export const bigQueryViewCreated = (viewName: string) => {
  logger.log(`Created BigQuery view: ${viewName}`);
};

export const bigQueryViewCreating = (viewName: string) => {
  logger.log(`Creating BigQuery view: ${viewName}`);
};

export const bigQueryViewAlreadyExists = (
  viewName: string,
  datasetName: string
) => {
  logger.log(
    `View with id ${viewName} already exists in dataset ${datasetName}.`
  );
};

export const bigQueryViewUpdated = (viewName: string) => {
  logger.log(`Updated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpdating = (viewName: string) => {
  logger.log(`Updating existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpToDate = (viewName: string) => {
  logger.log(`BigQuery view: ${viewName} is up to date`);
};

export const bigQueryViewValidated = (viewName: string) => {
  logger.log(`Validated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewValidating = (viewName: string) => {
  logger.log(`Validating existing BigQuery view: ${viewName}`);
};

export const complete = () => {
  logger.log("Completed execution of extension");
};

export const dataInserted = (rowCount: number) => {
  logger.log(`Inserted ${rowCount} row(s) of data into BigQuery`);
};

export const dataInserting = (rowCount: number) => {
  logger.log(`Inserting ${rowCount} row(s) of data into BigQuery`);
};

export const dataTypeInvalid = (
  fieldName: string,
  fieldType: string,
  dataType: string
) => {
  logger.warn(
    `Field '${fieldName}' has invalid data. Expected: ${fieldType}, received: ${dataType}`
  );
};

export const error = (
  includeEvent: boolean,
  message: string,
  err: Error,
  event?: any, // Made optional, as it is not always required
  eventTrackerConfig?: any // Made optional, as it is not always required
) => {
  const logDetails: Record<string, any> = { error: err };

  if (includeEvent && event) {
    logDetails.event = event;
  }

  if (includeEvent && eventTrackerConfig) {
    logDetails.eventTrackerConfig = eventTrackerConfig;
  }

  logger.error(`Error when mirroring data to BigQuery: ${message}`, logDetails);
};

export const init = () => {
  logger.log("Initializing extension with configuration", config);
};

export const start = () => {
  logger.log("Started execution of extension with configuration", config);
};

export const timestampMissingValue = (fieldName: string) => {
  logger.warn(
    `Missing value for timestamp field: ${fieldName}, using default timestamp instead.`
  );
};

export const logEventAction = (
  action: string,
  document_name: string,
  event_id: string,
  operation: ChangeType
) => {
  logger.info(action, {
    document_name,
    event_id,
    operation,
  });
};

export const logFailedEventAction = (
  action: string,
  document_name: string,
  event_id: string,
  operation: ChangeType,
  error: Error
) => {
  const changeTypeMap = {
    0: "CREATE",
    1: "DELETE",
    2: "UPDATE",
    3: "IMPORT",
  };

  logger.error(action, {
    document_name,
    event_id,
    operation: changeTypeMap[operation],
    error,
  });
};

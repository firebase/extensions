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

import { Table } from "@google-cloud/bigquery";
import { firestore } from "firebase-admin";
import { logger } from "./logger";

export const arrayFieldInvalid = (fieldName: string) => {
  logger.warn(`Array field '${fieldName}' does not contain an array, skipping`);
};

export const bigQueryDatasetCreated = (datasetId: string) => {
  logger.info(`Created BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetCreating = (datasetId: string) => {
  logger.debug(`Creating BigQuery dataset: ${datasetId}`);
};

export const bigQueryDatasetExists = (datasetId: string) => {
  logger.info(`BigQuery dataset already exists: ${datasetId}`);
};

export const bigQueryErrorRecordingDocumentChange = (e: Error) => {
  logger.error(`Error recording document changes.`, e);
};

export const bigQueryLatestSnapshotViewQueryCreated = (query: string) => {
  logger.debug(`BigQuery latest snapshot view query:\n${query}`);
};

export const bigQuerySchemaViewCreated = (name: string) => {
  logger.debug(`BigQuery created schema view ${name}\n`);
};

export const bigQueryTableAlreadyExists = (
  tableName: string,
  datasetName: string
) => {
  logger.debug(
    `BigQuery table with name ${tableName} already ` +
      `exists in dataset ${datasetName}!`
  );
};

export const bigQueryTableCreated = (tableName: string) => {
  logger.info(`Created BigQuery table: ${tableName}`);
};

export const bigQueryTableCreating = (tableName: string) => {
  logger.debug(`Creating BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdated = (tableName: string) => {
  logger.info(`Updated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpdating = (tableName: string) => {
  logger.debug(`Updating existing BigQuery table: ${tableName}`);
};

export const bigQueryTableUpToDate = (tableName: string) => {
  logger.info(`BigQuery table: ${tableName} is up to date`);
};

export const bigQueryTableValidated = (tableName: string) => {
  logger.info(`Validated existing BigQuery table: ${tableName}`);
};

export const bigQueryTableValidating = (tableName: string) => {
  logger.debug(`Validating existing BigQuery table: ${tableName}`);
};

export const bigQueryUserDefinedFunctionCreating = (functionName: string) => {
  logger.debug(`Creating BigQuery user-defined function ${functionName}`);
};

export const bigQueryUserDefinedFunctionCreated = (functionName: string) => {
  logger.info(`Created BigQuery user-defined function ${functionName}`);
};

export const bigQueryViewCreated = (viewName: string) => {
  logger.info(`Created BigQuery view: ${viewName}`);
};

export const bigQueryViewCreating = (viewName: string, query: string) => {
  logger.debug(`Creating BigQuery view: ${viewName}\nQuery:\n${query}`);
};

export const bigQueryViewAlreadyExists = (
  viewName: string,
  datasetName: string
) => {
  logger.info(
    `View with id ${viewName} already exists in dataset ${datasetName}.`
  );
};

export const bigQueryViewUpdated = (viewName: string) => {
  logger.info(`Updated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpdating = (viewName: string) => {
  logger.debug(`Updating existing BigQuery view: ${viewName}`);
};

export const bigQueryViewUpToDate = (viewName: string) => {
  logger.info(`BigQuery view: ${viewName} is up to date`);
};

export const bigQueryViewValidated = (viewName: string) => {
  logger.info(`Validated existing BigQuery view: ${viewName}`);
};

export const bigQueryViewValidating = (viewName: string) => {
  logger.debug(`Validating existing BigQuery view: ${viewName}`);
};

export const complete = () => {
  logger.info("Completed mod execution");
};

export const dataInserted = (rowCount: number) => {
  logger.debug(`Inserted ${rowCount} row(s) of data into BigQuery`);
};

/**
 * The two retry paths must be distinguishable in the logs: only one of them
 * discards columns, and an operator investigating suspected column loss has no
 * other way to tell which retry ran.
 *
 * Warn rather than debug: this is the one path that leaves a column permanently
 * null for the rows it recovers, and debug is suppressed at the default log
 * level, so an operator would have had to already suspect the loss to see it.
 */
export const dataInsertRetriedIgnoringUnknownColumns = (rowCount: number) => {
  logger.warn(
    `Retrying insert of ${rowCount} row(s) of data into BigQuery, ignoring unknown columns. Any column BigQuery rejected will be null for these rows.`
  );
};

export const dataInsertRetriedAfterTransientError = (rowCount: number) => {
  logger.debug(
    `Retrying insert of ${rowCount} row(s) of data into BigQuery after a transient failure, with options unchanged`
  );
};

export const dataInserting = (rowCount: number) => {
  logger.debug(`Inserting ${rowCount} row(s) of data into BigQuery`);
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

export const error = (err: Error) => {
  logger.error("Error when mirroring data to BigQuery", err);
};

export const timestampMissingValue = (fieldName: string) => {
  logger.warn(
    `Missing value for timestamp field: ${fieldName}, using default timestamp instead.`
  );
};

export const addNewColumn = (table: string, field: string) => {
  logger.info(`Updated '${table}' table with a '${field}' column`);
};

export const addPartitionFieldColumn = (table, field) => {
  logger.info(
    `Updated '${table}' table with a partition field '${field}' column`
  );
};

export const firestoreTimePartitionFieldError = (
  documentName: string | undefined,
  fieldName: string | undefined,
  firestoreFieldName: string | undefined,
  firestoreFieldData: any
) => {
  logger.warn(
    `Wrong type of Firestore Field for TimePartitioning. Accepts only strings in BigQuery format (DATE, DATETIME, TIMESTAMP) and Firestore Timestamp. Firestore Document field path: ${documentName}. Field name: ${firestoreFieldName}. Field data: ${firestoreFieldData}. Schema field "${fieldName}" value will be null.`
  );
};

export const firestoreTimePartitioningParametersWarning = (
  fieldName: string | undefined,
  fieldType: string | undefined,
  firestoreFieldName: string | undefined,
  dataFirestoreField: firestore.Timestamp | string | undefined
) => {
  logger.warn(
    "All TimePartitioning option parameters need to be available to create new custom schema field"
  );
  !fieldName && logger.warn(`Parameter missing: TIME_PARTITIONING_FIELD`);
  !fieldType && logger.warn(`Parameter missing: TIME_PARTITIONING_FIELD_TYPE`);
  !firestoreFieldName &&
    logger.warn(`Parameter missing: TIME_PARTITIONING_FIRESTORE_FIELD`);
  !dataFirestoreField &&
    logger.warn(
      `No data found in Firestore Document under selected field: "${firestoreFieldName}"`
    );
};

export const bigQueryTableInsertErrors = (
  insertErrors: [
    {
      row: object;
      errors: Array<{ message: string }>;
    }
  ]
) => {
  logger.warn(`Error when inserting data to table.`);

  // Defensive throughout: this runs on the terminal path of a failed insert,
  // and throwing here would replace the insert error the caller needs.
  if (!Array.isArray(insertErrors)) return;

  insertErrors.forEach((error) => {
    logger.warn("ROW DATA JSON:");
    logger.warn(error?.row);

    if (!Array.isArray(error?.errors)) return;

    error.errors.forEach((error) =>
      logger.warn(`ROW ERROR MESSAGE: ${error?.message}`)
    );
  });
};

export const failedBackupWrite = (error: unknown) => {
  logger.warn(
    `Could not write failed rows to the backup collection. The original insert error is still thrown. Backup error: ${error}`
  );
};

export const updatedClustering = (fields: string) => {
  logger.info(`Clustering updated with new settings fields: ${fields}`);
};

export const removedClustering = (tableName: string) => {
  logger.info(`Clustering removed on ${tableName}`);
};

export const cannotPartitionExistingTable = (table: Table) => {
  logger.warn(
    `Cannot partition an existing table ${table.dataset.id}_${table.id}`
  );
};

export function invalidProjectIdWarning(bqProjectId: string) {
  logger.warn(`Invalid project Id ${bqProjectId}, data cannot be synchronized`);
}
export function invalidTableReference() {
  logger.warn(`No valid table reference is available. Skipping partitioning`);
}

export function hourAndDatePartitioningWarning() {
  logger.warn(
    `Cannot partition table with hour partitioning and Date. For DATE columns, the partitions can have daily, monthly, or yearly granularity. Skipping partitioning`
  );
}

export function invalidClusteringTypes(fields: string) {
  logger.warn(
    `Unable to add clustering, field(s) ${fields} have invalid types.`
  );
}

export function invalidClustering(fields: string) {
  logger.warn(
    `Unable to add clustering, field(s) ${fields} do not exist on the expected table`
  );
}
export const tableCreationError = (table, message) => {
  logger.warn(`Error caught creating table`, message);
};

export const failedToInitializeWait = (message) => {
  logger.warn(`Failed while waiting to initialize.`, message);
};

export const updatingMetadata = (tableName, resources) => {
  logger.info(
    `Updated Metadata on ${tableName}, ${JSON.stringify(resources)})`
  );
};

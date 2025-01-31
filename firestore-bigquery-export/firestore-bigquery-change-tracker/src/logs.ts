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
import { logger } from "firebase-functions";

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

export const bigQuerySchemaViewCreated = (name: string) => {
  logger.log(`BigQuery created schema view ${name}\n`);
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

export const bigQueryUserDefinedFunctionCreating = (functionName: string) => {
  logger.log(`Creating BigQuery user-defined function ${functionName}`);
};

export const bigQueryUserDefinedFunctionCreated = (functionName: string) => {
  logger.log(`Created BigQuery user-defined function ${functionName}`);
};

export const bigQueryViewCreated = (viewName: string) => {
  logger.log(`Created BigQuery view: ${viewName}`);
};

export const bigQueryViewCreating = (viewName: string, query: string) => {
  logger.log(`Creating BigQuery view: ${viewName}\nQuery:\n${query}`);
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
  logger.log("Completed mod execution");
};

export const dataInserted = (rowCount: number) => {
  logger.log(`Inserted ${rowCount} row(s) of data into BigQuery`);
};

export const dataInsertRetried = (rowCount: number) => {
  logger.log(
    `Retried to insert ${rowCount} row(s) of data into BigQuery (ignoring unknown columns)`
  );
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

export const error = (err: Error) => {
  logger.error("Error when mirroring data to BigQuery", err);
};

export const timestampMissingValue = (fieldName: string) => {
  logger.warn(
    `Missing value for timestamp field: ${fieldName}, using default timestamp instead.`
  );
};

export const addNewColumn = (table: string, field: string) => {
  logger.log(`Updated '${table}' table with a '${field}' column`);
};

export const addPartitionFieldColumn = (table, field) => {
  logger.log(
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

  insertErrors?.forEach((error) => {
    logger.warn("ROW DATA JSON:");
    logger.warn(error.row);

    error.errors?.forEach((error) =>
      logger.warn(`ROW ERROR MESSAGE: ${error.message}`)
    );
  });
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

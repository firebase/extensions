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

import * as bigquery from "@google-cloud/bigquery";
import {
  firestoreToBQTable,
  firestoreToBQView,
  validateBQTable,
  validateBQView,
} from "./schema";
import { FirestoreField, FirestoreSchema } from "../firestore";
import * as logs from "../logs";

const bq = new bigquery.BigQuery();

/**
 * Ensure that the defined Firestore schema exists within BigQuery and
 * contains the correct information.
 *
 * This will check for the following:
 * 1) That the dataset exists
 * 2) That a `${tableName}_raw` data table exists to store how the data changes
 * over time
 * 3) That a `${tableName}` view exists to visualise the current state of the
 * data
 *
 * NOTE: This currently gets executed on every cold start of the function.
 * Ideally this would run once when the mod is installed if that were
 * possible in the future.
 */
export const initializeSchema = async (
  datasetId: string,
  tableName: string,
  schema: FirestoreSchema,
  idFieldNames: string[]
) => {
  logs.bigQuerySchemaInitializing();

  const viewName = tableName;
  const realTableName = rawTableName(tableName);

  await intialiseDataset(datasetId);
  await initializeTable(datasetId, realTableName, schema.fields, idFieldNames);
  await initializeView(
    datasetId,
    realTableName,
    viewName,
    schema,
    idFieldNames
  );

  logs.bigQuerySchemaInitialized();
};

export const buildDataRow = (
  idFieldValues: { [fieldName: string]: string },
  insertId: string,
  operation: "DELETE" | "INSERT" | "UPDATE",
  timestamp: string,
  data?: Object
): bigquery.RowMetadata => {
  return {
    data,
    id: idFieldValues,
    insertId,
    operation,
    timestamp,
  };
};

/**
 * Insert a row of data into the BigQuery `raw` data table
 */
export const insertData = async (
  datasetId: string,
  tableName: string,
  rows: bigquery.RowMetadata | bigquery.RowMetadata[]
): Promise<void> => {
  const realTableName = rawTableName(tableName);
  const dataset = bq.dataset(datasetId);
  const table = dataset.table(realTableName);
  const rowCount = Array.isArray(rows) ? rows.length : 1;

  logs.dataInserting(rowCount);
  await table.insert(rows);
  logs.dataInserted(rowCount);
};

const rawTableName = (tableName: string) => `${tableName}_raw`;

/**
 * Check that the specified dataset exists, and create it if it doesn't.
 */
const intialiseDataset = async (datasetId: string) => {
  const dataset = bq.dataset(datasetId);
  const [datasetExists] = await dataset.exists();
  if (datasetExists) {
    logs.bigQueryDatasetExists(datasetId);
  } else {
    logs.bigQueryDatasetCreating(datasetId);
    await dataset.create();
    logs.bigQueryDatasetCreated(datasetId);
  }
  return dataset;
};

/**
 * Check that the table exists within the specified dataset, and create it
 * if it doesn't.  If the table does exist, validate that the BigQuery schema
 * is correct and add any missing fields.
 */
const initializeTable = async (
  datasetId: string,
  tableName: string,
  fields: FirestoreField[],
  idFieldNames: string[]
): Promise<bigquery.Table> => {
  const dataset = bq.dataset(datasetId);
  let table = dataset.table(tableName);
  const [tableExists] = await table.exists();
  if (tableExists) {
    table = await validateBQTable(table, fields, idFieldNames);
  } else {
    logs.bigQueryTableCreating(tableName);
    const options = {
      // `friendlyName` needs to be here to satisfy TypeScript
      friendlyName: tableName,
      schema: firestoreToBQTable(fields, idFieldNames),
    };
    await table.create(options);
    logs.bigQueryTableCreated(tableName);
  }
  return table;
};

/**
 * Check that the view exists within the specified dataset, and create it if
 * it doesn't.
 *
 * The view is created over the `raw` data table and extracts the latest state
 * of the underlying data, whilst excluding any rows that have been delete.
 *
 * By default, the document ID is used as the row ID, but can be overriden
 * using the `idField` property in the schema definition.
 */
const initializeView = async (
  datasetId: string,
  tableName: string,
  viewName: string,
  schema: FirestoreSchema,
  idFieldNames: string[]
): Promise<bigquery.Table> => {
  const dataset = bq.dataset(datasetId);
  let view = dataset.table(viewName);

  const [viewExists] = await view.exists();
  if (viewExists) {
    view = await validateBQView(view, tableName, schema, idFieldNames);
  } else {
    logs.bigQueryViewCreating(viewName);
    const options = {
      // `friendlyName` needs to be here to satisfy TypeScript
      friendlyName: tableName,
      view: firestoreToBQView(datasetId, tableName, schema, idFieldNames),
    };
    await view.create(options);
    logs.bigQueryViewCreated(viewName);
  }
  return view;
};

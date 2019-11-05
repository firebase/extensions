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
import * as errors from "../errors";
import * as logs from "../logs";
import * as sqlFormatter from "sql-formatter";

export type BigQueryFieldMode = "NULLABLE" | "REPEATED" | "REQUIRED";
export type BigQueryFieldType =
  | "BOOLEAN"
  | "NUMERIC"
  | "RECORD"
  | "STRING"
  | "TIMESTAMP";
export type BigQueryField = {
  fields?: BigQueryField[];
  mode: BigQueryFieldMode;
  name: string;
  type: BigQueryFieldType;
};

const bigQueryField = (
  name: string,
  type: BigQueryFieldType,
  mode?: BigQueryFieldMode,
  fields?: BigQueryField[]
): BigQueryField => ({
  fields,
  mode: mode || "NULLABLE",
  name,
  type,
});

// These field types form the basis of the `raw` data table
export const dataField = bigQueryField("data", "STRING", "NULLABLE");
export const documentNameField = bigQueryField(
  "document_name",
  "STRING",
  "REQUIRED"
);
export const eventIdField = bigQueryField("event_id", "STRING", "REQUIRED");
export const operationField = bigQueryField("operation", "STRING", "REQUIRED");
export const timestampField = bigQueryField(
  "timestamp",
  "TIMESTAMP",
  "REQUIRED"
);

// These field types are used for the Firestore GeoPoint data type
export const latitudeField = bigQueryField("latitude", "NUMERIC");
export const longitudeField = bigQueryField("longitude", "NUMERIC");

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
export const firestoreToBQTable = (): BigQueryField[] => [
  timestampField,
  eventIdField,
  documentNameField,
  operationField,
  dataField,
];

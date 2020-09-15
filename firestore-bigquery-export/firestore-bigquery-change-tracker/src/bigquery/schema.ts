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

export const documentIdField = {
  name: "document_id",
  mode: "NULLABLE",
  type: "STRING",
  description: "The document id as defined in the firestore database.",
};

/*
 * We cannot specify a schema for view creation, and all view columns default
 * to the NULLABLE mode.
 */
export const RawChangelogViewSchema: any = {
  fields: [
    {
      name: "timestamp",
      mode: "NULLABLE",
      type: "TIMESTAMP",
      description:
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT.",
    },
    {
      name: "event_id",
      mode: "NULLABLE",
      type: "STRING",
      description:
        "The ID of the most-recent document change event that triggered the Cloud Function created by the extension. Empty for imports.",
    },
    {
      name: "document_name",
      mode: "NULLABLE",
      type: "STRING",
      description:
        "The full name of the changed document, for example, projects/collection/databases/(default)/documents/users/me).",
    },
    {
      name: "operation",
      mode: "NULLABLE",
      type: "STRING",
      description: "One of CREATE, UPDATE, IMPORT.",
    },
    {
      name: "data",
      mode: "NULLABLE",
      type: "STRING",
      description:
        "The full JSON representation of the current document state.",
    },
    documentIdField,
  ],
};

export const RawChangelogSchema: any = {
  fields: [
    {
      name: "timestamp",
      mode: "REQUIRED",
      type: "TIMESTAMP",
      description:
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT.",
    },
    {
      name: "event_id",
      mode: "REQUIRED",
      type: "STRING",
      description:
        "The ID of the document change event that triggered the Cloud Function created by the extension. Empty for imports.",
    },
    {
      name: "document_name",
      mode: "REQUIRED",
      type: "STRING",
      description:
        "The full name of the changed document, for example, projects/collection/databases/(default)/documents/users/me).",
    },
    {
      name: "operation",
      mode: "REQUIRED",
      type: "STRING",
      description: "One of CREATE, UPDATE, IMPORT, or DELETE.",
    },
    {
      name: "data",
      mode: "NULLABLE",
      type: "STRING",
      description:
        "The full JSON representation of the document state after the indicated operation is applied. This field will be null for DELETE operations.",
    },
    documentIdField,
  ],
};

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

import { FirestoreBigQueryEventHistoryTrackerConfig } from "./types";
import { BigQueryFieldMode, BigQueryFieldType, BigQueryField } from "./types";

const bigQueryField = (
  name: string,
  type: BigQueryFieldType,
  mode?: BigQueryFieldMode,
  fields?: BigQueryField[]
): BigQueryField => ({
  fields,
  mode: mode || BigQueryFieldMode.NULLABLE,
  name,
  type,
});

// These field types form the basis of the `raw` data table
export const timestampField = bigQueryField(
  "timestamp",
  BigQueryFieldType.TIMESTAMP,
  BigQueryFieldMode.REQUIRED
);

export const documentIdField = {
  name: "document_id",
  mode: BigQueryFieldMode.NULLABLE,
  type: BigQueryFieldType.STRING,
  description: "The document id as defined in the firestore database.",
};

export const documentPathParams = {
  name: "path_params",
  mode: BigQueryFieldMode.NULLABLE,
  type: BigQueryFieldType.STRING,
  description:
    "JSON string representing wildcard params with Firestore Document ids",
};

export const oldDataField = {
  name: "old_data",
  mode: BigQueryFieldMode.NULLABLE,
  type: BigQueryFieldType.STRING,
  description:
    "The full JSON representation of the document state before the indicated operation is applied. This field will be null for CREATE operations.",
};

/*
 * We cannot specify a schema for view creation, and all view columns default
 * to the NULLABLE mode.
 */

export const RawChangelogViewSchema = {
  fields: [
    {
      name: "timestamp",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.TIMESTAMP,
      description:
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT.",
    },
    {
      name: "event_id",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The ID of the most-recent document change event that triggered the Cloud Function created by the extension. Empty for imports.",
    },
    {
      name: "document_name",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The full name of the changed document, for example, projects/collection/databases/(default)/documents/users/me).",
    },
    {
      name: "operation",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description: "One of CREATE, UPDATE, IMPORT.",
    },
    {
      name: "data",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The full JSON representation of the current document state.",
    },
    {
      name: "old_data",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The full JSON representation of the document state before the indicated operation is applied. This field will be null for CREATE operations.",
    },
    documentIdField,
  ],
};

export const RawChangelogSchema = {
  fields: [
    {
      name: "timestamp",
      mode: BigQueryFieldMode.REQUIRED,
      type: BigQueryFieldType.TIMESTAMP,
      description:
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT.",
    },
    {
      name: "event_id",
      mode: BigQueryFieldMode.REQUIRED,
      type: BigQueryFieldType.STRING,
      description:
        "The ID of the document change event that triggered the Cloud Function created by the extension. Empty for imports.",
    },
    {
      name: "document_name",
      mode: BigQueryFieldMode.REQUIRED,
      type: BigQueryFieldType.STRING,
      description:
        "The full name of the changed document, for example, projects/collection/databases/(default)/documents/users/me).",
    },
    {
      name: "operation",
      mode: BigQueryFieldMode.REQUIRED,
      type: BigQueryFieldType.STRING,
      description: "One of CREATE, UPDATE, IMPORT, or DELETE.",
    },
    {
      name: "data",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The full JSON representation of the document state after the indicated operation is applied. This field will be null for DELETE operations.",
    },
    {
      name: "old_data",
      mode: BigQueryFieldMode.NULLABLE,
      type: BigQueryFieldType.STRING,
      description:
        "The full JSON representation of the document state before the indicated operation is applied. This field will be null for CREATE operations.",
    },
    documentIdField,
  ],
};

// Helper function for Partitioned Changelogs field
export const getNewPartitionField = (
  config: FirestoreBigQueryEventHistoryTrackerConfig
) => {
  const { timePartitioningField, timePartitioningFieldType } = config;

  return {
    name: timePartitioningField,
    mode: BigQueryFieldMode.NULLABLE,
    type: timePartitioningFieldType,
    description: "The document TimePartition partition field selected by user",
  };
};

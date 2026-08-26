/*
 * Copyright 2026 Google LLC
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

import {
  defineString,
  expr,
  projectID,
  select,
} from "firebase-functions/params";
import type {
  BigqueryFirestoreExportConfig,
  DeployTimeOptions,
  LogLevel,
} from "./export-config";

const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "silent"] as const;
const instanceId = defineString("INSTANCE_ID");

const params = {
  instanceId,
  bigqueryDatasetLocation: defineString("BIGQUERY_DATASET_LOCATION", {
    label: "BigQuery Dataset Location",
    description:
      "What is the location of the BigQuery dataset referenced in the query?",

    default: "US",
  }),
  transferConfigName: defineString("TRANSFER_CONFIG_NAME", { default: "" }),
  datasetId: defineString("DATASET_ID", {
    label: "Dataset ID",
    description:
      "What's the BigQuery destination dataset you'd like to use? Each transfer run will write to a table in this destination dataset.",
    input: { text: { example: "customer_data" } },
  }),
  tableName: defineString("TABLE_NAME", {
    label: "Destination Table Name",
    description:
      "What's the destination table name prefix you'd like to use? Each transfer run will write to the table with this name, postfixed with the runtime.",
    input: { text: { example: "transactions" } },
  }),
  queryString: defineString("QUERY_STRING", {
    label: "Query String",
    description: "What's the BQ query you'd like to execute?",
    input: {
      text: {
        example: "SELECT * from <PROJECT_ID>.customer_data.transactions",
      },
    },
  }),
  displayName: defineString("DISPLAY_NAME", {
    label: "Display Name",
    description: "What display name would you like to use?",
    input: { text: { example: "Daily Rollup - Customer Transactions" } },
  }),
  partitioningField: defineString("PARTITIONING_FIELD", {
    label: "Partitioning Field",
    description:
      "What's the partitioning field on the destination table ID? Leave empty if not using a partitioning field.",
    default: "",
    input: { text: { example: "timestamp" } },
  }),
  schedule: defineString("SCHEDULE", {
    label: "Schedule",
    description:
      "What's the execution schedule you'd like to use for this query?",
    input: { text: { example: "every 15 minutes" } },
  }),
  firestoreCollection: defineString("COLLECTION_PATH", {
    label: "Firestore Collection",
    description:
      "What's the top-level Firestore Collection to store transfer configs, run metadata, and query output?",

    default: "transferConfigs",
    input: {
      text: {
        example: "transferConfigs",

        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  logLevel: defineString("LOG_LEVEL", {
    label: "Log Level",
    description: "What's the log level you'd like to use for this extension?",

    default: "info",
    input: select([...LOG_LEVEL_OPTIONS]),
  }),
};

export const CONFIG_EXPRESSIONS: DeployTimeOptions = {
  pubSubTopic: expr`kit-${instanceId}-processMessages`,
};

function optional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeLogLevel(value: string): LogLevel {
  const normalized = value.toLowerCase();
  return LOG_LEVEL_OPTIONS.includes(normalized as LogLevel)
    ? (normalized as LogLevel)
    : "info";
}

/** Reads runtime values from Firebase deploy-time parameters. */
export function configFromEnv(): BigqueryFirestoreExportConfig {
  const resolvedInstanceId = params.instanceId.value();

  return {
    bigqueryDatasetLocation: params.bigqueryDatasetLocation.value(),
    projectId: projectID.value(),
    instanceId: resolvedInstanceId,
    transferConfigName: optional(params.transferConfigName.value()),
    datasetId: params.datasetId.value(),
    tableName: params.tableName.value(),
    queryString: params.queryString.value(),
    displayName: params.displayName.value(),
    partitioningField: optional(params.partitioningField.value()),
    schedule: params.schedule.value(),
    pubSubTopic: `kit-${resolvedInstanceId}-processMessages`,
    firestoreCollection: params.firestoreCollection.value(),
    logLevel: normalizeLogLevel(params.logLevel.value()),
  };
}

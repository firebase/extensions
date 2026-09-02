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
    input: select({
      "Columbus, Ohio (us-east5)": "us-east5",
      "Iowa (us-central1)": "us-central1",
      "Las Vegas (us-west4)": "us-west4",
      "Los Angeles (us-west2)": "us-west2",
      "Montréal (northamerica-northeast1)": "northamerica-northeast1",
      "Northern Virginia (us-east4)": "us-east4",
      "Oregon (us-west1)": "us-west1",
      "Salt Lake City (us-west3)": "us-west3",
      "São Paulo (southamerica-east1)": "southamerica-east1",
      "Santiago (southamerica-west1)": "southamerica-west1",
      "South Carolina (us-east1)": "us-east1",
      "Toronto (northamerica-northeast2)": "northamerica-northeast2",
      "Delhi (asia-south2)": "asia-south2",
      "Hong Kong (asia-east2)": "asia-east2",
      "Jakarta (asia-southeast2)": "asia-southeast2",
      "Melbourne (australia-southeast2)": "australia-southeast2",
      "Mumbai (asia-south1)": "asia-south1",
      "Osaka (asia-northeast2)": "asia-northeast2",
      "Seoul (asia-northeast3)": "asia-northeast3",
      "Singapore (asia-southeast1)": "asia-southeast1",
      "Sydney (australia-southeast1)": "australia-southeast1",
      "Taiwan (asia-east1)": "asia-east1",
      "Tokyo (asia-northeast1)": "asia-northeast1",
      "Belgium (europe-west1)": "europe-west1",
      "Finland (europe-north1)": "europe-north1",
      "Frankfurt (europe-west3)": "europe-west3",
      "London (europe-west2)": "europe-west2",
      "Madrid (europe-southwest1)": "europe-southwest1",
      "Milan (europe-west8)": "europe-west8",
      "Netherlands (europe-west4)": "europe-west4",
      "Paris (europe-west9)": "europe-west9",
      "Warsaw (europe-central2)": "europe-central2",
      "Zürich (europe-west6)": "europe-west6",
      "US Multi-Region (US)": "US",
      "EU Mutli-Region (EU)": "EU",
    }),
  }),
  transferConfigName: defineString("TRANSFER_CONFIG_NAME", { default: "" }),
  pubSubTopic: defineString("PUB_SUB_TOPIC", {
    label: "Pub/Sub Topic",
    description:
      "Which Pub/Sub topic should receive BigQuery Data Transfer completion notifications? Leave the default unless you are migrating from the bigquery-firestore-export extension, whose topic is named ext-<instance id>-processMessages. Pointing this at the extension's topic keeps the existing scheduled query's notification settings untouched.",

    default: expr`kit-${instanceId}-processMessages`,
  }),
  datasetId: defineString("DATASET_ID", {
    label: "Dataset ID",
    description:
      "What's the BigQuery destination dataset you'd like to use? Each transfer run will write to a table in this destination dataset.",
    input: {
      text: {
        nonEmpty: true,
        example: "customer_data",
      },
    },
  }),
  tableName: defineString("TABLE_NAME", {
    label: "Destination Table Name",
    description:
      "What's the destination table name prefix you'd like to use? Each transfer run will write to the table with this name, postfixed with the runtime.",
    input: {
      text: {
        nonEmpty: true,
        example: "transactions",
      },
    },
  }),
  queryString: defineString("QUERY_STRING", {
    label: "Query String",
    description: "What's the BQ query you'd like to execute?",
    input: {
      text: {
        nonEmpty: true,

        example: "SELECT * from <PROJECT_ID>.customer_data.transactions",
      },
    },
  }),
  displayName: defineString("DISPLAY_NAME", {
    label: "Display Name",
    description: "What display name would you like to use?",
    input: {
      text: {
        nonEmpty: true,
        example: "Daily Rollup - Customer Transactions",
      },
    },
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
    input: {
      text: {
        nonEmpty: true,
        example: "every 15 minutes",
      },
    },
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
    input: select({
      DEBUG: "debug",
      INFO: "info",
      WARN: "warn",
      ERROR: "error",
      SILENT: "silent",
    }),
  }),
};

export const CONFIG_EXPRESSIONS: DeployTimeOptions = {
  pubSubTopic: params.pubSubTopic,
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
    pubSubTopic: params.pubSubTopic.value(),
    firestoreCollection: params.firestoreCollection.value(),
    logLevel: normalizeLogLevel(params.logLevel.value()),
  };
}

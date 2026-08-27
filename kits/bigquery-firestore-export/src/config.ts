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

/**
 * Mirrors the BigQuery dataset locations offered by the upstream extension. The
 * query job must run in the same location as the dataset it reads, so a value
 * outside this list only fails once the scheduled query runs.
 */
const BIGQUERY_DATASET_LOCATION_OPTIONS: Record<string, string> = {
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
  "EU Multi-Region (EU)": "EU",
};

const instanceId = defineString("INSTANCE_ID");

export const params = {
  instanceId,
  bigqueryDatasetLocation: defineString("BIGQUERY_DATASET_LOCATION", {
    default: "US",
    input: select(BIGQUERY_DATASET_LOCATION_OPTIONS),
  }),
  transferConfigName: defineString("TRANSFER_CONFIG_NAME", { default: "" }),
  datasetId: defineString("DATASET_ID"),
  tableName: defineString("TABLE_NAME"),
  queryString: defineString("QUERY_STRING"),
  displayName: defineString("DISPLAY_NAME"),
  partitioningField: defineString("PARTITIONING_FIELD", { default: "" }),
  schedule: defineString("SCHEDULE"),
  firestoreCollection: defineString("COLLECTION_PATH", {
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

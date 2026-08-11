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
    default: "US",
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

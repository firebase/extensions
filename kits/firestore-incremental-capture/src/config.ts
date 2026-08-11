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

import type { Expression } from "firebase-functions/params";
import { defineString, projectID, select } from "firebase-functions/params";
import type { CaptureConfig, LogLevel } from "./capture-config";

const DATASET_LOCATION_OPTIONS = [
  "us",
  "eu",
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "northamerica-northeast1",
  "southamerica-east1",
  "europe-central2",
  "europe-north1",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-south1",
  "asia-southeast1",
  "asia-southeast2",
  "australia-southeast1",
] as const;

/**
 * Regions the functions and Dataflow jobs can run in. Restricted to the regions
 * the extension offered, which are the ones Dataflow flex templates support.
 */
const LOCATION_OPTIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west2",
  "us-west3",
  "us-west4",
  "europe-central2",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west6",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-south1",
  "asia-southeast1",
  "asia-southeast2",
  "northamerica-northeast1",
  "southamerica-east1",
  "australia-southeast1",
] as const;

const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "silent"] as const;

/** Deploy-time expressions the entry point needs before params can be read. */
export interface ConfigExpressions {
  syncCollectionPath: Expression<string>;
  location: Expression<string>;
}

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  location: defineString("LOCATION", {
    default: "us-central1",
    input: select([...LOCATION_OPTIONS]),
  }),
  syncCollectionPath: defineString("SYNC_COLLECTION_PATH", {
    default: "posts",
  }),
  syncDataset: defineString("SYNC_DATASET", { default: "backup_dataset" }),
  syncTable: defineString("SYNC_TABLE", { default: "backup_table" }),
  backupInstanceId: defineString("BACKUP_INSTANCE_ID"),
  datasetLocation: defineString("DATASET_LOCATION", {
    default: "us",
    input: select([...DATASET_LOCATION_OPTIONS]),
  }),
  dataflowRegion: defineString("DATAFLOW_REGION", { default: "" }),
  bucketName: defineString("BUCKET_NAME", { default: "" }),
  instanceId: defineString("INSTANCE_ID", {
    default: "firestore-incremental-capture",
  }),
  logLevel: defineString("LOG_LEVEL", {
    default: "info",
    input: select([...LOG_LEVEL_OPTIONS]),
  }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  syncCollectionPath: params.syncCollectionPath,
  location: params.location,
};

/** Coerce an empty-string param value to `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function normalizeLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case "debug":
    case "info":
    case "warn":
    case "error":
    case "silent":
      return level.toLowerCase() as LogLevel;
    default:
      return "info";
  }
}

/**
 * Resolves all deploy-time params into a {@link CaptureConfig}.
 *
 * Param values are read when this is called, not at import, so the Firebase
 * deploy-time discovery pass can analyze the entry point without resolving
 * params early.
 *
 * @param defaultBucketName - The project's default storage bucket, used when
 *   the `BUCKET_NAME` param is unset. The param is not defaulted to a guessed
 *   name because the default bucket's domain differs by project age.
 * @returns The capture configuration assembled from environment params.
 */
export function configFromEnv(defaultBucketName?: string): CaptureConfig {
  return {
    projectId: projectID.value(),
    syncCollectionPath: params.syncCollectionPath.value(),
    backupInstanceId: params.backupInstanceId.value(),
    datasetId: params.syncDataset.value(),
    tableId: params.syncTable.value(),
    datasetLocation: optional(params.datasetLocation.value()),
    location: optional(params.location.value()),
    dataflowRegion: optional(params.dataflowRegion.value()),
    bucketName: optional(params.bucketName.value()) || defaultBucketName || "",
    instanceId: optional(params.instanceId.value()),
    logLevel: normalizeLogLevel(params.logLevel.value()),
  };
}

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

import type { Expression } from "firebase-functions/params";
import {
  defineString,
  expr,
  projectID,
  select,
} from "firebase-functions/params";
import type { ExportConfig } from "./export-config";

type ConfigExpression<T extends string | number | boolean> = Expression<T>;

const FUNCTION_LOCATION_OPTIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "northamerica-northeast1",
  "southamerica-east1",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west6",
  "europe-central2",
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
const BIGQUERY_DATASET_LOCATION_OPTIONS = [
  "US",
  "EU",
  "us-central1",
  "us-east1",
  "us-east4",
  "us-east5",
  "us-south1",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "northamerica-northeast1",
  "northamerica-northeast2",
  "southamerica-east1",
  "southamerica-west1",
  "europe-central2",
  "europe-north1",
  "europe-southwest1",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "europe-west8",
  "europe-west9",
  "europe-west12",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-south1",
  "asia-south2",
  "asia-southeast1",
  "asia-southeast2",
  "australia-southeast1",
  "australia-southeast2",
  "me-central1",
  "me-central2",
  "me-west1",
  "africa-south1",
] as const;
const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "silent"] as const;

export interface ConfigExpressions {
  location: ConfigExpression<string>;
  pubsubTopic: ConfigExpression<string>;
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
    input: select([...FUNCTION_LOCATION_OPTIONS]),
  }),
  bigqueryDatasetLocation: defineString("BIGQUERY_DATASET_LOCATION", {
    default: "US",
    input: select([...BIGQUERY_DATASET_LOCATION_OPTIONS]),
  }),
  displayName: defineString("DISPLAY_NAME"),
  datasetId: defineString("DATASET_ID"),
  tableName: defineString("TABLE_NAME"),
  queryString: defineString("QUERY_STRING"),
  partitioningField: defineString("PARTITIONING_FIELD", { default: "" }),
  schedule: defineString("SCHEDULE"),
  collectionPath: defineString("COLLECTION_PATH", {
    default: "transferConfigs",
  }),
  instanceId: defineString("INSTANCE_ID", {
    default: "bigquery-firestore-export",
  }),
  pubsubTopic: defineString("PUBSUB_TOPIC", { default: "" }),
  logLevel: defineString("LOG_LEVEL", {
    default: "info",
    input: select([...LOG_LEVEL_OPTIONS]),
  }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  location: params.location,
  // The empty-string default falls back to `ext-<INSTANCE_ID>-processMessages`
  // at deploy time via this CEL expression, mirroring the runtime fallback in
  // resolveExportConfig so the deployed trigger topic and the DTS notification
  // topic can never disagree.
  pubsubTopic: params.pubsubTopic
    .notEquals("")
    .thenElse(
      params.pubsubTopic,
      expr`ext-${params.instanceId}-processMessages`
    ),
};

/** Coerce an empty-string param value to `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

/**
 * Resolves all deploy-time params into an {@link ExportConfig}.
 *
 * Param values are read when this is called. During the Firebase deploy-time
 * discovery pass params return their declared defaults. This is the bridge for
 * the env-driven path: env params in, typed config out, which the main entry
 * point wires into the exported functions.
 *
 * @returns The export configuration assembled from environment params.
 */
export function configFromEnv(): ExportConfig {
  return {
    projectId: projectID.value(),
    displayName: params.displayName.value(),
    datasetId: params.datasetId.value(),
    tableName: params.tableName.value(),
    queryString: params.queryString.value(),
    schedule: params.schedule.value(),
    location: optional(params.location.value()),
    bigqueryDatasetLocation: optional(params.bigqueryDatasetLocation.value()),
    instanceId: optional(params.instanceId.value()),
    pubsubTopic: optional(params.pubsubTopic.value()),
    partitioningField: optional(params.partitioningField.value()),
    firestoreCollection: optional(params.collectionPath.value()),
    logLevel: optional(params.logLevel.value()),
  };
}

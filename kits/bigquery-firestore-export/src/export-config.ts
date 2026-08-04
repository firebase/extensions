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
import type { LogLevel } from "./types";

type ConfigValue<T extends string | number | boolean> = T | Expression<T>;

/**
 * The export configuration. The main entry point builds it from deploy-time
 * params; handler consumers can construct it directly.
 *
 * `projectId`, `displayName`, `datasetId`, `tableName`, `queryString`, and
 * `schedule` are required; everything else has a sensible default.
 */
export interface ExportConfig {
  /** GCP project id. */
  projectId: ConfigValue<string>;
  /** DTS scheduled-query display name (immutable after creation). */
  displayName: ConfigValue<string>;
  /** BigQuery destination dataset id. */
  datasetId: ConfigValue<string>;
  /** Destination table name prefix; runs write to
   *  `${tableName}_{run_time|"%H%M%S"}`. */
  tableName: ConfigValue<string>;
  /** The scheduled BigQuery SQL query. */
  queryString: ConfigValue<string>;
  /** DTS schedule, e.g. `every 15 minutes`. */
  schedule: ConfigValue<string>;

  /** Region for the functions. Defaults to `us-central1`. */
  location?: ConfigValue<string>;
  /** BigQuery dataset location, e.g. `US`, `EU`. Defaults to `US`. */
  bigqueryDatasetLocation?: ConfigValue<string>;
  /** Logical instance id: written to each transfer-config document as
   *  `extInstanceId` and used as the default topic-name suffix. Migrating
   *  extension users set this to their old `EXT_INSTANCE_ID`. Defaults to
   *  `bigquery-firestore-export`. */
  instanceId?: ConfigValue<string>;
  /** Short Pub/Sub topic name DTS notifies on run completion. Defaults to
   *  `ext-<instanceId>-processMessages` (the legacy extension topic name). */
  pubsubTopic?: ConfigValue<string>;
  /** Creation-time partitioning field for the destination table. Cannot be
   *  cleared once set (DTS API limitation). */
  partitioningField?: ConfigValue<string>;
  /** Root Firestore collection for config/run/output documents. Defaults to
   *  `transferConfigs`. */
  firestoreCollection?: ConfigValue<string>;
  /** Log verbosity. Defaults to `info`. */
  logLevel?: ConfigValue<string>;
}

/** {@link ExportConfig} with all defaults applied. */
export interface ResolvedExportConfig {
  projectId: string;
  displayName: string;
  datasetId: string;
  tableName: string;
  queryString: string;
  schedule: string;
  location: string;
  bigqueryDatasetLocation: string;
  instanceId: string;
  pubsubTopic: string;
  partitioningField?: string;
  firestoreCollection: string;
  logLevel: LogLevel;
}

const DEFAULT_INSTANCE_ID = "bigquery-firestore-export";

function isExpression<T extends string | number | boolean>(
  value: ConfigValue<T>
): value is Expression<T> {
  return typeof value === "object" && value !== null && "value" in value;
}

function resolveConfigValue<T extends string | number | boolean>(
  value: ConfigValue<T> | undefined
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isExpression(value) ? value.value() : value;
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required config value: ${name}`);
  }
  return value;
}

function normalizeLogLevel(level: string | undefined): LogLevel {
  switch ((level || "").toLowerCase()) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
      return "error";
    case "silent":
      return "silent";
    default:
      return "info";
  }
}

/**
 * Resolves an {@link ExportConfig} (possibly containing param expressions) into
 * concrete values, applying defaults.
 *
 * @param config - The configuration to resolve.
 * @returns The resolved configuration.
 */
export function resolveExportConfig(
  config: ExportConfig
): ResolvedExportConfig {
  const instanceId =
    resolveConfigValue(config.instanceId) || DEFAULT_INSTANCE_ID;
  const partitioningField = resolveConfigValue(config.partitioningField);

  return {
    projectId: required(resolveConfigValue(config.projectId), "projectId"),
    displayName: required(
      resolveConfigValue(config.displayName),
      "displayName"
    ),
    datasetId: required(resolveConfigValue(config.datasetId), "datasetId"),
    tableName: required(resolveConfigValue(config.tableName), "tableName"),
    queryString: required(
      resolveConfigValue(config.queryString),
      "queryString"
    ),
    schedule: required(resolveConfigValue(config.schedule), "schedule"),
    location: resolveConfigValue(config.location) || "us-central1",
    bigqueryDatasetLocation:
      resolveConfigValue(config.bigqueryDatasetLocation) || "US",
    instanceId,
    pubsubTopic:
      resolveConfigValue(config.pubsubTopic) ||
      `ext-${instanceId}-processMessages`,
    ...(partitioningField ? { partitioningField } : {}),
    firestoreCollection:
      resolveConfigValue(config.firestoreCollection) || "transferConfigs",
    logLevel: normalizeLogLevel(resolveConfigValue(config.logLevel)),
  };
}

/**
 * Full Pub/Sub topic resource name DTS publishes run notifications to.
 *
 * @param config - The resolved configuration.
 * @returns `projects/<projectId>/topics/<pubsubTopic>`.
 */
export function topicResourceName(config: ResolvedExportConfig): string {
  return `projects/${config.projectId}/topics/${config.pubsubTopic}`;
}

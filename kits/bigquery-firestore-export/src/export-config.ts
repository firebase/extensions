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

import { PermanentConfigurationError } from "./errors";

/** Log levels supported by the original extension. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/** Public configuration for the BigQuery-to-Firestore functions. */
export interface BigqueryFirestoreExportConfig {
  /** Location of the BigQuery destination dataset, for example `US`. */
  bigqueryDatasetLocation: string;
  /** Google Cloud project id. */
  projectId: string;
  /** Stable id used to associate a DTS config with this deployment. */
  instanceId: string;
  /** Link this existing DTS config instead of creating one. */
  transferConfigName?: string;
  /** BigQuery destination dataset id. */
  datasetId: string;
  /** Prefix for per-run destination tables. */
  tableName: string;
  /** Scheduled query text. */
  queryString: string;
  /** Human-readable DTS scheduled-query name. */
  displayName: string;
  /** Optional destination-table partitioning field. */
  partitioningField?: string;
  /** BigQuery Data Transfer schedule, for example `every 15 minutes`. */
  schedule: string;
  /** Pub/Sub topic receiving DTS completion notifications. */
  pubSubTopic?: string;
  /** Root Firestore collection for configs and run output. */
  firestoreCollection?: string;
  /** Log verbosity. Defaults to `info`. */
  logLevel?: LogLevel;
}

/** Configuration after defaults and validation have been applied. */
export interface ResolvedBigqueryFirestoreExportConfig {
  bigqueryDatasetLocation: string;
  projectId: string;
  instanceId: string;
  transferConfigName?: string;
  datasetId: string;
  tableName: string;
  queryString: string;
  displayName: string;
  partitioningField?: string;
  schedule: string;
  pubSubTopic: string;
  firestoreCollection: string;
  logLevel: LogLevel;
}

/** Deploy-time values used to construct the v2 triggers. */
export interface DeployTimeOptions {
  pubSubTopic: string | Expression<string>;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new PermanentConfigurationError(
      `${field} must be a non-empty string. Set it in the deployment configuration, then redeploy.`
    );
  }
  return normalized;
}

function optional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

/** Applies package defaults and validates a user-supplied configuration. */
export function resolveConfig(
  config: BigqueryFirestoreExportConfig
): ResolvedBigqueryFirestoreExportConfig {
  const instanceId = required(config.instanceId, "instanceId");
  const logLevel = config.logLevel ?? "info";

  if (!["debug", "info", "warn", "error", "silent"].includes(logLevel)) {
    throw new PermanentConfigurationError(
      `Unsupported logLevel: ${logLevel}. Use one of debug, info, warn, error, silent, then redeploy.`
    );
  }

  return {
    bigqueryDatasetLocation: required(
      config.bigqueryDatasetLocation,
      "bigqueryDatasetLocation"
    ),
    projectId: required(config.projectId, "projectId"),
    instanceId,
    transferConfigName: optional(config.transferConfigName),
    datasetId: required(config.datasetId, "datasetId"),
    tableName: required(config.tableName, "tableName"),
    queryString: required(config.queryString, "queryString"),
    displayName: required(config.displayName, "displayName"),
    partitioningField: optional(config.partitioningField),
    schedule: required(config.schedule, "schedule"),
    pubSubTopic:
      optional(config.pubSubTopic) ?? `kit-${instanceId}-processMessages`,
    firestoreCollection:
      optional(config.firestoreCollection) ?? "transferConfigs",
    logLevel,
  };
}

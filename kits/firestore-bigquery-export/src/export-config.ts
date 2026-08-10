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
import type {
  ChangeTrackerConfig,
  LogLevel,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import type { Expression } from "firebase-functions/params";

type TrackerLogLevel = "debug" | "info" | "warn" | "error" | "silent";
type ConfigValue<T extends string | number | boolean | string[]> =
  | T
  | Expression<T>;

/** How the BigQuery changelog view is materialized. */
export type ViewType =
  | "view"
  | "materialized_incremental"
  | "materialized_non_incremental";

/**
 * The export configuration. The main entry point builds it from deploy-time
 * params; handler consumers can construct it directly.
 *
 * `collectionPath`, `datasetId`, `tableId`, `location`, and `projectId` are
 * required; everything else has a sensible default.
 */
export interface ExportConfig {
  /** Firestore collection (or collection group) path to mirror, e.g. `users`
   *  or `regions/{regionId}/users`. */
  collectionPath: ConfigValue<string>;
  /** BigQuery dataset id to write into. */
  datasetId: ConfigValue<string>;
  /** BigQuery changelog table id. */
  tableId: ConfigValue<string>;

  /** Region for the trigger and task queue. */
  location: ConfigValue<string>;
  /** BigQuery dataset location, e.g. `us`, `eu`. Defaults to `us`. */
  datasetLocation?: ConfigValue<string>;
  /** Project that owns the BigQuery dataset, if different from the function's
   *  project. */
  bqProjectId?: ConfigValue<string>;
  /** GCP project id. */
  projectId: ConfigValue<string>;
  /** Firestore database id. Defaults to `(default)`. */
  databaseId?: ConfigValue<string>;

  /** Include path-param values as columns. Defaults to `false`. */
  wildcardIds?: ConfigValue<boolean>;
  /** Skip writing the previous document state on updates. Defaults to `false`. */
  excludeOldData?: ConfigValue<boolean>;
  /** Use the newer snapshot view query syntax. Defaults to `false`. */
  useNewSnapshotQuerySyntax?: ConfigValue<boolean>;
  /** Changelog view strategy. Defaults to `view`. */
  viewType?: ConfigValue<ViewType>;

  /** Partitioning strategy for the changelog table. */
  partitioning?: ChangeTrackerConfig["partitioning"];
  /** Clustering columns (max 4). */
  clustering?: string[] | null;
  /** Materialized-view max staleness interval, e.g. `0-0 0 4:0:0`. */
  maxStaleness?: ConfigValue<string>;
  /** Incremental materialized-view refresh interval in minutes. */
  refreshIntervalMinutes?: ConfigValue<number>;

  /** Collection id used for the changelog backup table. */
  backupCollectionId?: ConfigValue<string>;
  /** Name of a transform function to apply before writing. */
  transformFunction?: ConfigValue<string>;
  /** Customer-managed encryption key for the dataset. */
  kmsKeyName?: ConfigValue<string>;

  /** Log verbosity. Defaults to `info`. */
  logLevel?: ConfigValue<TrackerLogLevel | LogLevel>;
}

/** {@link ExportConfig} with all defaults applied. */
export interface ResolvedExportConfig {
  collectionPath: string;
  datasetId: string;
  tableId: string;
  location: string;
  datasetLocation: string;
  bqProjectId?: string;
  projectId: string;
  databaseId: string;
  wildcardIds: boolean;
  excludeOldData: boolean;
  useNewSnapshotQuerySyntax: boolean;
  viewType: ViewType;
  partitioning?: ChangeTrackerConfig["partitioning"];
  clustering: string[] | null;
  maxStaleness?: string;
  refreshIntervalMinutes?: number;
  backupCollectionId?: string;
  transformFunction?: string;
  kmsKeyName?: string;
  logLevel: TrackerLogLevel;
}

function isExpression<T extends string | number | boolean | string[]>(
  value: ConfigValue<T>
): value is Expression<T> {
  return typeof value === "object" && value !== null && "value" in value;
}

function resolveConfigValue<T extends string | number | boolean | string[]>(
  value: ConfigValue<T>
): T {
  return isExpression(value) ? value.value() : value;
}

function resolveOptionalConfigValue<
  T extends string | number | boolean | string[]
>(value: ConfigValue<T> | undefined): T | undefined {
  return value === undefined ? undefined : resolveConfigValue(value);
}

/**
 * Applies defaults to an {@link ExportConfig}.
 *
 * @param config - The user-supplied configuration.
 * @returns The configuration with every field populated.
 */
export function resolveExportConfig(
  config: ExportConfig
): ResolvedExportConfig {
  const projectId = resolveConfigValue(config.projectId);
  const viewType = resolveOptionalConfigValue(config.viewType);
  const logLevel = resolveOptionalConfigValue(config.logLevel);

  return {
    collectionPath: resolveConfigValue(config.collectionPath),
    datasetId: resolveConfigValue(config.datasetId),
    tableId: resolveConfigValue(config.tableId),
    location: resolveConfigValue(config.location),
    datasetLocation: resolveOptionalConfigValue(config.datasetLocation) ?? "us",
    bqProjectId: resolveOptionalConfigValue(config.bqProjectId),
    projectId,
    databaseId: resolveOptionalConfigValue(config.databaseId) ?? "(default)",
    wildcardIds: resolveOptionalConfigValue(config.wildcardIds) ?? false,
    excludeOldData: resolveOptionalConfigValue(config.excludeOldData) ?? false,
    useNewSnapshotQuerySyntax:
      resolveOptionalConfigValue(config.useNewSnapshotQuerySyntax) ?? false,
    viewType: viewType ?? "view",
    partitioning: config.partitioning,
    clustering: config.clustering ?? null,
    maxStaleness: resolveOptionalConfigValue(config.maxStaleness),
    refreshIntervalMinutes: resolveOptionalConfigValue(
      config.refreshIntervalMinutes
    ),
    backupCollectionId: resolveOptionalConfigValue(config.backupCollectionId),
    transformFunction: resolveOptionalConfigValue(config.transformFunction),
    kmsKeyName: resolveOptionalConfigValue(config.kmsKeyName),
    logLevel: (logLevel as TrackerLogLevel) ?? "info",
  };
}

/**
 * Maps a resolved export config onto the change-tracker's config shape.
 *
 * @param config - The resolved export configuration.
 * @returns The {@link ChangeTrackerConfig} for the event history tracker.
 */
export function toTrackerConfig(
  config: ResolvedExportConfig
): ChangeTrackerConfig {
  return {
    firestoreInstanceId: config.databaseId,
    tableId: config.tableId,
    datasetId: config.datasetId,
    datasetLocation: config.datasetLocation,
    backupTableId: config.backupCollectionId,
    transformFunction: config.transformFunction,
    partitioning: config.partitioning,
    databaseId: config.databaseId,
    clustering: config.clustering,
    wildcardIds: config.wildcardIds,
    bqProjectId: config.bqProjectId ?? config.projectId,
    useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
    skipInit: true,
    kmsKeyName: config.kmsKeyName,
    useMaterializedView:
      config.viewType === "materialized_incremental" ||
      config.viewType === "materialized_non_incremental",
    useIncrementalMaterializedView:
      config.viewType === "materialized_incremental",
    maxStaleness: config.maxStaleness,
    refreshIntervalMinutes: config.refreshIntervalMinutes,
    logLevel: config.logLevel,
  };
}

/**
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

import { PartitioningStrategy } from "./partitioning/config";

/**
 * Configuration for {@link FirestoreBigQueryEventHistoryTracker}.
 */
export interface ChangeTrackerConfig {
  datasetId: string;
  tableId: string;
  firestoreInstanceId?: string;
  datasetLocation?: string;
  transformFunction?: string;
  partitioning?: PartitioningStrategy;
  clustering?: string[] | null;
  databaseId?: string;
  wildcardIds?: boolean;
  bqProjectId?: string;
  backupTableId?: string;
  useNewSnapshotQuerySyntax?: boolean;
  skipInit?: boolean;
  kmsKeyName?: string;
  useMaterializedView?: boolean;
  useIncrementalMaterializedView?: boolean;
  maxStaleness?: string;
  refreshIntervalMinutes?: number;
  logLevel?: "debug" | "info" | "warn" | "error" | "silent";
}

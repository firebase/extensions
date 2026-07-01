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

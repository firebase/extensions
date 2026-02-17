import { PartitioningStrategy } from "./partitioning/config";

/**
 * Base configuration for all variants. Includes all parameters
 * that are not dependent on the partitioning strategy.
 */
export interface Config {
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

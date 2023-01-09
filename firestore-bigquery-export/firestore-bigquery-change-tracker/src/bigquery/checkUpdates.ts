import { Table, TableMetadata } from "@google-cloud/bigquery/build/src/table";
import { Partitioning } from "./partitioning";

import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

interface TableRequiresUpdateOptions {
  table: Table;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  documentIdColExists: boolean;
  pathParamsColExists: boolean;
  oldDataColExists: boolean;
}

export async function tableRequiresUpdate({
  table,
  config,
  documentIdColExists,
  pathParamsColExists,
  oldDataColExists,
}: TableRequiresUpdateOptions): Promise<boolean> {
  /* Setup checks */
  const { metadata } = table;

  /** Check clustering */
  const configCluster = JSON.stringify(config.clustering);
  const tableCluster = JSON.stringify(metadata.clustering?.fields || []);
  if (configCluster !== tableCluster) return true;

  /** Check wildcards */
  if (!!config.wildcardIds !== pathParamsColExists) return true;

  /** Check document id column */
  if (!documentIdColExists) return true;

  /** Check old_data column exists */
  if (!oldDataColExists) return true;

  /** Check partitioning */
  const partitioning = new Partitioning(config, table);
  const isValidPartition =
    await partitioning.isValidPartitionForExistingTable();
  if (isValidPartition) return true;

  // No updates have occured.
  return false;
}

interface ViewRequiresUpdateOptions {
  metadata?: TableMetadata;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  documentIdColExists: boolean;
  pathParamsColExists: boolean;
  oldDataColExists: boolean;
}

export function viewRequiresUpdate({
  metadata,
  config,
  documentIdColExists,
  pathParamsColExists,
  oldDataColExists,
}: ViewRequiresUpdateOptions): boolean {
  /** Check wildcards */
  if (!!config.wildcardIds !== pathParamsColExists) return true;

  /** Check document id column */
  if (!documentIdColExists) return true;

  /** Check old_data column exists */
  if (!oldDataColExists) return true;

  /* Using the new query syntax for snapshots */
  if (metadata) {
    const query = metadata.view?.query || "";
    const hasLegacyQuery = query.includes("FIRST_VALUE");
    const { useNewSnapshotQuerySyntax } = config;

    /** If enabled and has legacy query, can update */
    if (useNewSnapshotQuerySyntax && hasLegacyQuery) return true;

    /** If not enabled and has an updated query, can update */
    if (!useNewSnapshotQuerySyntax && !hasLegacyQuery) return true;
  }

  // No updates have occured.
  return false;
}

import { Table, TableMetadata } from "@google-cloud/bigquery/build/src/table";
import { Partitioning } from "./partitioning";

import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

export async function tableRequiresUpdate(
  table: Table,
  config: FirestoreBigQueryEventHistoryTrackerConfig,
  schemaFields: any,
  documentIdColExists: boolean,
  pathParamsColExists: boolean
): Promise<boolean> {
  // If the table doesn't exist, return early.
  if (!table) {
    return false;
  }

  /* Setup checks */
  const {metadata} = table;

  /** Check clustering */
  const configCluster = JSON.stringify(config.clustering);
  const tableCluster = JSON.stringify(metadata.clustering?.fields || []);
  if (configCluster !== tableCluster) return true;

  /** Check wildcards */
  const initializedWildcards = schemaFields.some($ => $.name === "path_params").length;
  if (!!config.wildcardIds !== !!initializedWildcards) return true;

  /** Check document id column */
  if (!documentIdColExists) return true;

  /** Checkout pathParam column exists */
  if (!pathParamsColExists) return true;

  /** Check partitioning */
  const partitioning = new Partitioning(config, table);
  const isValidPartition = await partitioning.isValidPartitionForExistingTable();
  if(isValidPartition) return true;

  // No updates have occured.
  return false;
}

import { Dataset, Table, TableMetadata } from "@google-cloud/bigquery";
import {
  FirestoreBigQueryEventHistoryTrackerConfig,
  RawChangelogSchema,
} from "../..";
import * as logs from "../../../logs";
import { Clustering } from "../../clustering";
import { Partitioning } from "../../partitioning";
import { tableRequiresUpdate } from "../../checkUpdates";
import {
  documentIdField,
  documentPathParams,
  oldDataField,
} from "../../schema";
import { parseErrorMessage } from "../../utils";
import { handleExistingTable } from "./handleExistingTable";
import { handleNewTable } from "./handleNewTable";

interface InitializeRawChangeLogTableParams {
  changelogName: string;
  dataset: Dataset;
  table: Table;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
}

export async function initializeRawChangelogTable({
  changelogName,
  dataset,
  table,
  config,
}: InitializeRawChangeLogTableParams): Promise<Table> {
  try {
    const [tableExists] = await table.exists();
    const partitioning = new Partitioning(config, table);
    const clustering = new Clustering(config, table);

    if (tableExists) {
      return handleExistingTable({
        changelogName,
        dataset,
        table,
        config,
        partitioning,
        clustering,
      });
    }
    return handleNewTable({
      changelogName,
      table,
      config,
      partitioning,
      clustering,
    });
  } catch (error) {
    const message = parseErrorMessage(error);
    logs.tableCreationError(changelogName, message);
    throw new Error(message);
  }
}

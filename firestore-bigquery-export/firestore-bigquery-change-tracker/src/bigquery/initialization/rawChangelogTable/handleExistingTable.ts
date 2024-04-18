import { Dataset, Table, TableMetadata } from "@google-cloud/bigquery";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../..";
import * as logs from "../../../logs";
import { Clustering } from "../../clustering";
import { Partitioning } from "../../partitioning";
import { tableRequiresUpdate } from "../../checkUpdates";
import {
  documentIdField,
  documentPathParams,
  oldDataField,
} from "../../schema";

interface HandleExistingTableParams {
  changelogName: string;
  dataset: Dataset;
  table: Table;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  partitioning: Partitioning;
  clustering: Clustering;
}

export async function handleExistingTable({
  changelogName,
  dataset,
  table,
  config,
  partitioning,
  clustering,
}: HandleExistingTableParams): Promise<Table> {
  logs.bigQueryTableAlreadyExists(table.id, dataset.id);

  const [metadata] = (await table.getMetadata()) as TableMetadata[];
  const fields = metadata.schema ? metadata.schema.fields : [];

  await clustering.updateClustering(metadata);

  const documentIdColExists = !!fields.find(
    (column) => column.name === "document_id"
  );
  const pathParamsColExists = !!fields.find(
    (column) => column.name === "path_params"
  );

  const oldDataColExists = !!fields.find(
    (column) => column.name === "old_data"
  );

  if (!oldDataColExists) {
    fields.push(oldDataField);
    logs.addNewColumn(changelogName, oldDataField.name);
  }

  if (!documentIdColExists) {
    fields.push(documentIdField);
    logs.addNewColumn(changelogName, documentIdField.name);
  }
  if (!pathParamsColExists && config.wildcardIds) {
    fields.push(documentPathParams);
    logs.addNewColumn(changelogName, documentPathParams.name);
  }

  /** Updated table metadata if required */
  const shouldUpdate = await tableRequiresUpdate({
    table,
    config,
    documentIdColExists,
    pathParamsColExists,
    oldDataColExists,
  });

  if (shouldUpdate) {
    /** set partitioning */
    await partitioning.addPartitioningToSchema(metadata.schema.fields);

    /** update table metadata with changes. */
    await table.setMetadata(metadata);
    logs.updatingMetadata(changelogName, {
      config,
      documentIdColExists,
      pathParamsColExists,
      oldDataColExists,
    });
  }
  return table;
}

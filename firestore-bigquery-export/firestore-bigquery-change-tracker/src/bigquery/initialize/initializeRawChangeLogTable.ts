import { Clustering } from "../clustering";
import { Partitioning } from "../partitioning";
import * as logs from "../../logs";
import {
  documentIdField,
  documentPathParams,
  oldDataField,
  RawChangelogSchema,
} from "../schema";
import { tableRequiresUpdate } from "../checkUpdates";
import { Dataset, TableMetadata } from "@google-cloud/bigquery";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../types";

interface InitializeChangeLogTableParams {
  bigqueryDataset: Dataset;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  rawChangeLogTableName: string;
}

/**
 * Creates the raw change log table if it doesn't already exist.
 */
export async function initializeRawChangeLogTable({
  bigqueryDataset,
  config,
  rawChangeLogTableName,
}: InitializeChangeLogTableParams) {
  const table = bigqueryDataset.table(rawChangeLogTableName);
  const [tableExists] = await table.exists();

  const partitioning = new Partitioning(config, table);
  const clustering = new Clustering(config, table);

  if (tableExists) {
    logs.bigQueryTableAlreadyExists(table.id, bigqueryDataset.id);

    const [metadata] = await table.getMetadata();
    const fields = metadata.schema ? metadata.schema.fields : [];

    await clustering.updateClustering(metadata);

    const documentIdColExists = fields.find(
      (column) => column.name === "document_id"
    );
    const pathParamsColExists = fields.find(
      (column) => column.name === "path_params"
    );

    const oldDataColExists = fields.find(
      (column) => column.name === "old_data"
    );

    if (!oldDataColExists) {
      fields.push(oldDataField);
      logs.addNewColumn(rawChangeLogTableName, oldDataField.name);
    }

    if (!documentIdColExists) {
      fields.push(documentIdField);
      logs.addNewColumn(rawChangeLogTableName, documentIdField.name);
    }
    if (!pathParamsColExists && config.wildcardIds) {
      fields.push(documentPathParams);
      logs.addNewColumn(rawChangeLogTableName, documentPathParams.name);
    }

    /** Updated table metadata if required */
    const shouldUpdate = await tableRequiresUpdate({
      table,
      config: config,
      documentIdColExists,
      pathParamsColExists,
      oldDataColExists,
    });

    if (shouldUpdate) {
      /** set partitioning */
      await partitioning.addPartitioningToSchema(metadata.schema.fields);

      /** update table metadata with changes. */
      await table.setMetadata(metadata);
      logs.updatingMetadata(rawChangeLogTableName, {
        config: config,
        documentIdColExists,
        pathParamsColExists,
        oldDataColExists,
      });
    }
  } else {
    logs.bigQueryTableCreating(rawChangeLogTableName);
    const schema = { fields: [...RawChangelogSchema.fields] };

    if (config.wildcardIds) {
      schema.fields.push(documentPathParams);
    }
    const options: TableMetadata = {
      friendlyName: rawChangeLogTableName,
      schema,
    };

    if (config.kmsKeyName) {
      options["encryptionConfiguration"] = {
        kmsKeyName: config.kmsKeyName,
      };
    }

    //Add partitioning
    await partitioning.addPartitioningToSchema(schema.fields);

    await partitioning.updateTableMetadata(options);

    // Add clustering
    await clustering.updateClustering(options);

    try {
      await table.create(options);
      logs.bigQueryTableCreated(rawChangeLogTableName);
    } catch (ex) {
      logs.tableCreationError(rawChangeLogTableName, ex.message);
    }
  }

  return table;
}

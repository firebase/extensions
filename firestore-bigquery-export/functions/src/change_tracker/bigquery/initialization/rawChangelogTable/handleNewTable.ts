import { Table, TableMetadata } from "@google-cloud/bigquery";
import {
  FirestoreBigQueryEventHistoryTrackerConfig,
  RawChangelogSchema,
} from "../..";
import * as logs from "../../../logs";
import { Clustering } from "../../clustering";
import { Partitioning } from "../../partitioning";
import { documentPathParams } from "../../schema";
import { parseErrorMessage } from "../../utils";
import { functions } from "lodash";

interface HandleNewTableParams {
  changelogName: string;
  table: Table;
  config: FirestoreBigQueryEventHistoryTrackerConfig;
  partitioning: Partitioning;
  clustering: Clustering;
}

export async function handleNewTable({
  changelogName,
  table,
  config,
  partitioning,
  clustering,
}: HandleNewTableParams): Promise<Table> {
  logs.bigQueryTableCreating(changelogName); // this log is happening
  try {
    const schema = { fields: [...RawChangelogSchema.fields] };

    if (config.wildcardIds) {
      schema.fields.push(documentPathParams);
    }
    const options: TableMetadata = { friendlyName: changelogName, schema };

    if (config.kmsKeyName) {
      options["encryptionConfiguration"] = {
        kmsKeyName: config.kmsKeyName,
      };
    }

    try {
      await table.create(options);
      logs.bigQueryTableCreated(changelogName); // this one isn't
    } catch (error) {
      const message = parseErrorMessage(error);
      throw new Error("Error creating table: " + message);
    }

    try {
      await partitioning.addPartitioningToSchema(schema.fields);
    } catch (error) {
      throw new Error("Error adding partitioning to schema");
    }

    //   //Add partitioning
    try {
      await partitioning.updateTableMetadata(options);
    } catch (error) {
      const message = parseErrorMessage(error);
      throw new Error("Error adding partitioning to table: " + message);
    }

    // Add clustering
    try {
      await clustering.updateClustering(options);
    } catch (error) {
      const message = parseErrorMessage(error);
      throw new Error("Error adding clustering to table: " + message);
    }
  } catch (error) {
    console.error(error);
    // logs.tableCreationError(changelogName, error.message); // neither is this
  }

  return table;
}

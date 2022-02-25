import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";
import { TableMetadata } from "@google-cloud/bigquery";

export class Clustering {
  public config: FirestoreBigQueryEventHistoryTrackerConfig;
  public table: bigquery.Table;
  public schema: object;

  constructor(
    config: FirestoreBigQueryEventHistoryTrackerConfig,
    table?: bigquery.Table,
    schema?: object
  ) {
    this.config = config;
    this.table = table;
    this.schema = schema;
  }

  private async metaData(): Promise<TableMetadata> {
    const [metaData] = await this.table.getMetadata();

    return Promise.resolve(metaData);
  }

  hasValidTableReference() {
    logs.invalidTableReference();
    return !!this.table;
  }

  private async tableExists(): Promise<boolean> {
    /*** No table exists, return */
    const [tableExists] = await this.table.exists();
    return Promise.resolve(tableExists);
  }

  private async hasValidClusteringConfig(): Promise<boolean> {
    const metaData = await this.metaData();

    const { clustering } = this.config;

    /** Valid clustering if none provided */
    if (!clustering || !clustering.length) return Promise.resolve(true);

    const fieldNames = metaData.schema.fields.map(($) => $.name);

    const invalidFields = clustering.filter(($) => !fieldNames.includes($));

    if (invalidFields.length) {
      logs.invalidClustering(invalidFields.join(","));
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  private updateCluster = async (metaData) => {
    const clustering = { fields: this.config.clustering };

    metaData.clustering = clustering;
    logs.updatedClustering(this.config.clustering.join(","));

    return Promise.resolve();
  };

  private removeCluster = async (metaData) => {
    metaData.clustering = null;
    logs.removedClustering(this.table.id);

    return Promise.resolve();
  };

  updateClustering = async (metaData: TableMetadata): Promise<void> => {
    /** Check if table exists */
    if (!(await this.tableExists())) return Promise.resolve();

    /** check if class has valid table reference */
    if (!this.hasValidTableReference()) return Promise.resolve();

    /** Return if invalid config */
    if (!(await this.hasValidClusteringConfig())) return Promise.resolve();

    return !!this.config.clustering
      ? this.updateCluster(metaData)
      : this.removeCluster(metaData);
  };
}

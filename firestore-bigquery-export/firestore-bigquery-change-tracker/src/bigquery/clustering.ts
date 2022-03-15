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

  hasValidTableReference() {
    logs.invalidTableReference();
    return !!this.table;
  }

  private async hasInvalidFields(metaData: TableMetadata): Promise<boolean> {
    const { clustering = [] } = this.config;

    if (!clustering) return Promise.resolve(false);

    const fieldNames = metaData
      ? metaData.schema.fields.map(($) => $.name)
      : [];

    const invalidFields = clustering.filter(($) => !fieldNames.includes($));

    if (invalidFields.length) {
      logs.invalidClustering(invalidFields.join(","));
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
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
    /** Return if invalid config */
    if (await this.hasInvalidFields(metaData)) return Promise.resolve();

    return !!this.config.clustering && !!this.config.clustering.length
      ? this.updateCluster(metaData)
      : this.removeCluster(metaData);
  };
}

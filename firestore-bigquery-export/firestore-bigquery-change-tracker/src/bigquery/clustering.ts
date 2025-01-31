import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";
import { TableMetadata } from "@google-cloud/bigquery";

const VALID_CLUSTERING_TYPES = [
  "BIGNUMERIC",
  "BOOL",
  "DATE",
  "DATETIME",
  "GEOGRAPHY",
  "INT64",
  "NUMERIC",
  "RANGE",
  "STRING",
  "TIMESTAMP",
] as const;

type ValidClusteringType = typeof VALID_CLUSTERING_TYPES[number];

interface InvalidFieldType {
  fieldName: string;
  type: string;
}

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

    if (!clustering) {
      return false;
    }

    if (!clustering.length) {
      return false;
    }

    if (!metaData?.schema.fields.length) {
      return false;
    }

    const fields = metaData.schema.fields;
    const fieldNameToType = new Map(
      fields.map((field) => [field.name, field.type])
    );

    // First check if all clustering fields exist in the schema
    const nonExistentFields = clustering.filter(
      (fieldName) => !fieldNameToType.has(fieldName)
    );

    if (nonExistentFields.length) {
      logs.invalidClustering(nonExistentFields.join(","));
      return true;
    }

    // Then check for invalid types among existing clustering fields
    const invalidFieldTypes: InvalidFieldType[] = clustering
      .map((fieldName) => ({
        fieldName,
        type: fieldNameToType.get(fieldName)!,
      }))
      .filter(
        ({ type }) =>
          !VALID_CLUSTERING_TYPES.includes(type as ValidClusteringType)
      );

    if (invalidFieldTypes.length) {
      logs.invalidClusteringTypes(
        invalidFieldTypes
          .map(({ fieldName, type }) => `${fieldName} (${type})`)
          .join(", ")
      );
      return true;
    }

    return false;
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

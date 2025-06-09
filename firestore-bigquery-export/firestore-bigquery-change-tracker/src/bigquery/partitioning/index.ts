import * as bigquery from "@google-cloud/bigquery";
import * as functions from "firebase-functions";
import { TableField } from "@google-cloud/bigquery";
import { ChangeType, FirestoreDocumentChangeEvent } from "../..";
import * as logs from "../../logs";
import { PartitioningConfig } from "./config";
import { PartitionValueConverter } from "./converter";

export class Partitioning {
  public readonly config: PartitioningConfig;
  public table?: bigquery.Table;
  public schema?: object;

  constructor(
    partitioningConfig: PartitioningConfig,
    table?: bigquery.Table,
    schema?: object
  ) {
    this.config = partitioningConfig;
    this.table = table;
    this.schema = schema;
  }

  private getNewPartitionField() {
    if (
      !this.config.isFirestoreFieldPartitioning() &&
      !this.config.isFirestoreTimestampPartitioning()
    ) {
      return null;
    }

    const columnName = this.config.getBigQueryColumnName();
    if (!columnName) {
      return null;
    }

    const columnType = this.config.getBigQueryColumnType() || "TIMESTAMP";

    return {
      name: columnName,
      mode: "NULLABLE",
      type: columnType,
      description:
        "The document TimePartition partition field selected by user",
    };
  }

  getPartitionValue(
    event: FirestoreDocumentChangeEvent
  ): Record<string, string> {
    if (!this.config.isFirestoreFieldPartitioning()) {
      return {};
    }

    const data =
      event.operation === ChangeType.DELETE ? event.oldData : event.data;
    if (!data) return {};

    const fieldName = this.config.getBigQueryColumnName();
    const firestoreFieldName = this.config.getFirestoreFieldName();
    const fieldType = this.config.getBigQueryColumnType();

    if (!fieldName || !firestoreFieldName || !fieldType) {
      return {};
    }

    const fieldValue = data[firestoreFieldName];
    if (fieldValue === undefined) return {};

    const converter = new PartitionValueConverter(fieldType);
    const convertedValue = converter.convert(fieldValue);

    if (convertedValue === null) {
      logs.firestoreTimePartitionFieldError(
        event.documentName,
        fieldName,
        firestoreFieldName,
        fieldValue
      );
      return {};
    }

    return { [fieldName]: convertedValue };
  }

  async isTablePartitioned(): Promise<boolean> {
    if (!this.table) return false;
    const [metadata] = await this.table.getMetadata();
    return !!metadata.timePartitioning;
  }

  async isValidPartitionForExistingTable(): Promise<boolean> {
    if (this.config.isNoPartitioning()) return false;

    const isPartitioned = await this.isTablePartitioned();
    return !isPartitioned;
  }

  async updateTableMetadata(options: bigquery.TableMetadata): Promise<void> {
    if (this.config.isNoPartitioning()) return;
    if (!this.table) return;

    const [metadata] = await this.table.getMetadata();
    if (metadata.timePartitioning) {
      logs.cannotPartitionExistingTable(this.table);
      return;
    }

    if (this.hasHourAndDatePartitionConfig()) return;

    const granularity = this.config.getGranularity();

    if (this.config.isIngestionTimePartitioning()) {
      if (granularity && granularity !== "NONE") {
        options.timePartitioning = { type: granularity };
      }
    } else if (
      this.config.isFirestoreTimestampPartitioning() ||
      this.config.isFirestoreFieldPartitioning()
    ) {
      const columnName = this.config.getBigQueryColumnName();
      if (granularity && granularity !== "NONE" && columnName) {
        options.timePartitioning = {
          type: granularity,
          field: columnName,
        };
      }
    }
  }

  async addPartitioningToSchema(fields: TableField[]): Promise<void> {
    if (
      !this.config.isFirestoreFieldPartitioning() &&
      !this.config.isFirestoreTimestampPartitioning()
    ) {
      return;
    }

    const newField = this.getNewPartitionField();

    if (!newField) {
      return;
    }

    if (fields.some((field) => field.name === newField.name)) {
      return;
    }

    fields.push(newField);
    functions.logger.log(
      `Added new partition field: ${newField.name} to schema for table.`
    );
  }

  private hasHourAndDatePartitionConfig(): boolean {
    if (
      this.config.isFirestoreFieldPartitioning() &&
      this.config.getGranularity() === "HOUR" &&
      this.config.getBigQueryColumnType() === "DATE"
    ) {
      logs.hourAndDatePartitioningWarning();
      return true;
    }
    return false;
  }
}

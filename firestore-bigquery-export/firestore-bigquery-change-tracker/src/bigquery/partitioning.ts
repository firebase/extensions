// src/partitioning.ts

import { z } from "zod";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "./types"; // Assumes public types are in ./types
import { ChangeType, FirestoreDocumentChangeEvent } from "..";
import * as firebase from "firebase-admin";
import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";
import * as functions from "firebase-functions";
import { BigQuery, TableField } from "@google-cloud/bigquery";

const BaseSchema = z.object({
  timePartitioning: z.any(),
  timePartitioningColumn: z.any(),
});

const NoPartitioningInternalSchema = BaseSchema.extend({
  partitioningType: z.literal("NONE"),
});
const IngestionTimeInternalSchema = BaseSchema.extend({
  partitioningType: z.literal("INGESTION"),
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
});
const TimestampInternalSchema = BaseSchema.extend({
  partitioningType: z.literal("TIMESTAMP"),
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
  timePartitioningColumn: z.literal("timestamp"),
});
const FieldInternalSchema = BaseSchema.extend({
  partitioningType: z.literal("FIELD"),
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
  timePartitioningColumn: z.string().min(1),
  timePartitioningFieldType: z.enum(["TIMESTAMP", "DATE", "DATETIME"]),
  timePartitioningFirestoreField: z.string().min(1),
});

const DiscriminatedSchema = z.discriminatedUnion("partitioningType", [
  NoPartitioningInternalSchema,
  IngestionTimeInternalSchema,
  TimestampInternalSchema,
  FieldInternalSchema,
]);

const InternalPartitioningSchema = z.preprocess((data) => {
  if (typeof data !== "object" || !data) return data;
  const config = data as Record<string, unknown>;

  let partitioningType: string = "UNKNOWN";
  const timePartitioning = config.timePartitioning;
  const timePartitioningColumn = config.timePartitioningColumn;

  if (
    timePartitioning === null ||
    timePartitioning === "NONE" ||
    timePartitioning === undefined
  ) {
    partitioningType = "NONE";
  } else if (timePartitioningColumn === "timestamp") {
    partitioningType = "TIMESTAMP";
  } else if (
    typeof timePartitioningColumn === "string" &&
    timePartitioningColumn.length > 0 &&
    config.timePartitioningFieldType &&
    config.timePartitioningFirestoreField
  ) {
    partitioningType = "FIELD";
  } else if (
    timePartitioningColumn === null ||
    timePartitioningColumn === undefined
  ) {
    partitioningType = "INGESTION";
  }
  return { ...config, partitioningType };
}, DiscriminatedSchema);

type ParsedPartitioningConfig = z.infer<typeof InternalPartitioningSchema>;

class PartitionValueConverter {
  constructor(private fieldType: "TIMESTAMP" | "DATE" | "DATETIME") {}

  private isTimestampLike(
    value: any
  ): value is { _seconds: number; _nanoseconds: number } {
    return (
      value !== null &&
      typeof value === "object" &&
      typeof value._seconds === "number" &&
      typeof value._nanoseconds === "number"
    );
  }

  convert(value: unknown): string | null {
    let date: Date;

    if (value instanceof firebase.firestore.Timestamp) {
      date = value.toDate();
    } else if (this.isTimestampLike(value)) {
      date = new firebase.firestore.Timestamp(
        value._seconds,
        value._nanoseconds
      ).toDate();
    } else if (value instanceof Date && !isNaN(value.getTime())) {
      date = value;
    } else {
      // Not a supported date/timestamp format
      return null;
    }

    switch (this.fieldType) {
      case "DATETIME":
        return BigQuery.datetime(date.toISOString()).value;
      case "DATE":
        return BigQuery.date(date.toISOString().substring(0, 10)).value;
      case "TIMESTAMP":
        return BigQuery.timestamp(date).value;
    }
  }
}

// Helper function for Partitioned Changelogs field
export const getNewPartitionField = (config: ParsedPartitioningConfig) => {
  if (
    config.partitioningType !== "FIELD" &&
    config.partitioningType !== "TIMESTAMP"
  ) {
    return null;
  }

  const columnName =
    config.partitioningType === "FIELD"
      ? config.timePartitioningColumn
      : "timestamp";

  if (!columnName) {
    return null;
  }

  return {
    name: columnName,
    mode: "NULLABLE",
    type:
      config.partitioningType === "FIELD" && config.timePartitioningFieldType
        ? config.timePartitioningFieldType
        : "TIMESTAMP",
    description: "The document TimePartition partition field selected by user",
  };
};

export class Partitioning {
  public readonly config: ParsedPartitioningConfig;
  public table?: bigquery.Table;
  public schema?: object;

  constructor(
    rawConfig: FirestoreBigQueryEventHistoryTrackerConfig,
    table?: bigquery.Table,
    schema?: object
  ) {
    this.config = InternalPartitioningSchema.parse(rawConfig);
    this.table = table;
    this.schema = schema;
  }

  getPartitionValue(
    event: FirestoreDocumentChangeEvent
  ): Record<string, string> {
    if (this.config.partitioningType !== "FIELD") {
      return {};
    }

    const data =
      event.operation === ChangeType.DELETE ? event.oldData : event.data;
    if (!data) return {};

    const {
      timePartitioningColumn: fieldName,
      timePartitioningFirestoreField: firestoreFieldName,
      timePartitioningFieldType,
    } = this.config;

    const fieldValue = data[firestoreFieldName];
    if (fieldValue === undefined) return {};

    const converter = new PartitionValueConverter(timePartitioningFieldType);
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
    if (this.config.partitioningType === "NONE") return false;

    const isPartitioned = await this.isTablePartitioned();
    return !isPartitioned;
  }

  /**
   * Updates the BigQuery table metadata with partitioning options.
   */
  async updateTableMetadata(options: bigquery.TableMetadata): Promise<void> {
    if (this.config.partitioningType === "NONE") return;
    if (!this.table) return;

    const [metadata] = await this.table.getMetadata();
    if (metadata.timePartitioning) {
      logs.cannotPartitionExistingTable(this.table);
      return;
    }

    if (this.hasHourAndDatePartitionConfig()) return;

    switch (this.config.partitioningType) {
      case "INGESTION":
        options.timePartitioning = { type: this.config.timePartitioning };
        break;
      case "TIMESTAMP":
      case "FIELD":
        options.timePartitioning = {
          type: this.config.timePartitioning,
          field: this.config.timePartitioningColumn,
        };
        break;
    }
  }

  /**
   * Adds the partitioning field to a schema definition if necessary.
   */
  async addPartitioningToSchema(fields: TableField[]): Promise<void> {
    if (
      this.config.partitioningType !== "FIELD" &&
      this.config.partitioningType !== "TIMESTAMP"
    ) {
      return;
    }

    const newField = getNewPartitionField({
      timePartitioningColumn: this.config.timePartitioningColumn,
      timePartitioningFieldType:
        this.config.partitioningType === "FIELD"
          ? this.config.timePartitioningFieldType
          : "TIMESTAMP",
    });

    // Check if field already exists
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
      this.config.partitioningType === "FIELD" &&
      this.config.timePartitioning === "HOUR" &&
      this.config.timePartitioningFieldType === "DATE"
    ) {
      logs.hourAndDatePartitioningWarning();
      return true;
    }
    return false;
  }
}

// partitioning.ts - Type-Safe Version

import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import { ChangeType, FirestoreDocumentChangeEvent } from "..";
import * as firebase from "firebase-admin";
import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";
import * as functions from "firebase-functions";
import { getNewPartitionField } from "./schema";
import { BigQuery, TableMetadata, TableField } from "@google-cloud/bigquery";

// Constants
const PARTITION_TYPES = ["HOUR", "DAY", "MONTH", "YEAR"] as const;
const FIELD_TYPES = ["TIMESTAMP", "DATE", "DATETIME"] as const;
const BUILT_IN_FIELDS = [
  "timestamp",
  "document_name",
  "event_id",
  "operation",
] as const;

type PartitionType = typeof PARTITION_TYPES[number];
type FieldType = typeof FIELD_TYPES[number];
type BuiltInField = typeof BUILT_IN_FIELDS[number];

interface TimestampLike {
  _seconds: number;
  _nanoseconds: number;
}

interface HasToDate {
  toDate(): unknown;
}

interface ValidationResult {
  proceed: boolean;
  message: string;
}

class PartitionValueConverter {
  constructor(private fieldType?: string) {}

  convert(value: unknown): string | null {
    if (typeof value === "string") {
      return value;
    }

    const date = this.extractDate(value);
    if (!date) {
      return null;
    }

    return this.formatForBigQuery(date);
  }

  private extractDate(value: unknown): Date | null {
    // Firebase Timestamp
    if (value instanceof firebase.firestore.Timestamp) {
      return value.toDate();
    }

    if (this.isTimestampLike(value)) {
      const timestamp = this.convertTimestampLike(value);
      return timestamp?.toDate() || null;
    }

    if (this.hasToDateMethod(value)) {
      try {
        const date = value.toDate();
        return this.isValidDate(date) ? date : null;
      } catch {
        return null;
      }
    }

    if (Object.prototype.toString.call(value) === "[object Date]") {
      return this.isValidDate(value) ? value : null;
    }

    return null;
  }

  private isTimestampLike(value: unknown): value is TimestampLike {
    if (value instanceof firebase.firestore.Timestamp) return true;
    return (
      typeof value === "object" &&
      value !== null &&
      "_seconds" in value &&
      typeof (value as TimestampLike)._seconds === "number" &&
      "_nanoseconds" in value &&
      typeof (value as TimestampLike)._nanoseconds === "number"
    );
  }

  private convertTimestampLike(
    value: TimestampLike
  ): firebase.firestore.Timestamp | null {
    if (value instanceof firebase.firestore.Timestamp) return value;

    try {
      if (
        !Number.isFinite(value._seconds) ||
        !Number.isFinite(value._nanoseconds)
      ) {
        console.warn("Invalid timestamp values:", value);
        return null;
      }

      return new firebase.firestore.Timestamp(
        value._seconds,
        value._nanoseconds
      );
    } catch (error) {
      console.warn("Failed to convert to Firebase Timestamp:", error);
      return null;
    }
  }

  private hasToDateMethod(value: unknown): value is HasToDate {
    return (
      value !== null &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as HasToDate).toDate === "function"
    );
  }

  private isValidDate(date: unknown): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  private formatForBigQuery(date: Date): string {
    switch (this.fieldType) {
      case "DATETIME":
        return BigQuery.datetime(date.toISOString()).value;
      case "DATE":
        return BigQuery.date(date.toISOString().substring(0, 10)).value;
      case "TIMESTAMP":
      default:
        return BigQuery.timestamp(date).value;
    }
  }
}

export class Partitioning {
  public config: FirestoreBigQueryEventHistoryTrackerConfig;
  public table: bigquery.Table | undefined;
  public schema: object | undefined;

  constructor(
    config: FirestoreBigQueryEventHistoryTrackerConfig,
    table?: bigquery.Table,
    schema?: object
  ) {
    this.config = config;
    this.table = table;
    this.schema = schema;
  }

  async isValidPartitionForExistingTable(): Promise<boolean> {
    if (!this.isPartitioningEnabled()) return false;

    const isPartitioned = await this.isTablePartitioned();
    if (isPartitioned) return false;

    return this.hasValidCustomPartitionConfig();
  }

  async addPartitioningToSchema(fields: TableField[]): Promise<void> {
    if (!this.config.timePartitioningField) {
      return;
    }

    const validation = await this.shouldAddPartitioningToSchema(fields);

    if (!validation.proceed) {
      functions.logger.warn(
        `Did not add partitioning to schema: ${validation.message}`
      );
      return;
    }

    // Add new partitioning field
    const newField = getNewPartitionField(this.config);
    if (newField) {
      fields.push(newField);
      functions.logger.log(
        `Added new partition field: ${this.config.timePartitioningField} to table ID: ${this.table?.id}`
      );
    }
  }

  async shouldUpdateTableMetadata(): Promise<boolean> {
    if (!this.isPartitioningEnabled()) return false;
    if (!this.hasValidTableReference()) return false;
    if (await this.isTablePartitioned()) return false;
    if (!this.hasValidCustomPartitionConfig()) return false;
    if (!this.hasValidTimePartitionType()) return false;
    if (!this.hasValidTimePartitionOption()) return false;
    if (this.hasHourAndDatePartitionConfig()) return false;

    const fieldValidation = this.validateFieldBasedConfig();
    if (!fieldValidation.proceed) {
      if (fieldValidation.message) {
        functions.logger.warn(fieldValidation.message);
      }
      return false;
    }

    return true;
  }

  async updateTableMetadata(options: bigquery.TableMetadata): Promise<void> {
    const shouldUpdate = await this.shouldUpdateTableMetadata();
    if (!shouldUpdate) return;

    // All checks passed, set up partitioning
    if (this.config.timePartitioning) {
      options.timePartitioning = { type: this.config.timePartitioning };
    }

    if (this.config.timePartitioningField) {
      options.timePartitioning = {
        ...options.timePartitioning,
        field: this.config.timePartitioningField,
      };
    }
  }

  getPartitionValue(
    event: FirestoreDocumentChangeEvent
  ): Record<string, string> {
    // Handle null data
    if (event.data == null && event.oldData == null) return {};

    const firestoreFieldName = this.config.timePartitioningFirestoreField;
    const fieldName = this.config.timePartitioningField;

    if (!fieldName || !firestoreFieldName) {
      return {};
    }

    const fieldValue =
      event.operation === ChangeType.DELETE
        ? event.oldData?.[firestoreFieldName]
        : event.data?.[firestoreFieldName];

    if (!fieldValue) {
      return {};
    }

    const converter = new PartitionValueConverter(
      this.config.timePartitioningFieldType
    );
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

  hasValidTableReference(): boolean {
    if (!this.table) {
      logs.invalidTableReference();
    }
    return !!this.table;
  }

  async hasExistingSchema(): Promise<boolean> {
    if (!this.table) return false;
    const [metadata] = await this.table.getMetadata();
    return !!metadata.schema;
  }

  customFieldExists(fields: TableField[] = []): boolean {
    const { timePartitioningField } = this.config;
    if (!timePartitioningField) return false;
    return fields.some((field) => field.name === timePartitioningField);
  }

  // ========== Private Validation Methods ==========

  private isPartitioningEnabled(): boolean {
    const { timePartitioning } = this.config;
    return !!timePartitioning;
  }

  private hasValidCustomPartitionConfig(): boolean {
    if (!this.isPartitioningEnabled()) return false;
    return true;
  }

  private hasValidTimePartitionOption(): boolean {
    const { timePartitioning } = this.config;
    return PARTITION_TYPES.includes(timePartitioning as PartitionType);
  }

  private hasValidTimePartitionType(): boolean {
    const { timePartitioningFieldType } = this.config;

    if (!timePartitioningFieldType || timePartitioningFieldType === undefined) {
      return true;
    }

    return FIELD_TYPES.includes(timePartitioningFieldType as FieldType);
  }

  private hasHourAndDatePartitionConfig(): boolean {
    if (
      this.config.timePartitioning === "HOUR" &&
      this.config.timePartitioningFieldType === "DATE"
    ) {
      logs.hourAndDatePartitioningWarning();
      return true;
    }
    return false;
  }

  private validateFieldBasedConfig(): ValidationResult {
    // Check for invalid field-based configuration
    const hasFieldBasedConfig =
      this.config.timePartitioningFieldType ||
      this.config.timePartitioningFirestoreField;

    if (hasFieldBasedConfig && !this.config.timePartitioningField) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: field name required when using field-based partitioning",
      };
    }

    // Special handling for built-in fields
    const isBuiltInField =
      this.config.timePartitioningField &&
      BUILT_IN_FIELDS.includes(
        this.config.timePartitioningField as BuiltInField
      );

    // Check various configuration combinations
    if (
      this.config.timePartitioningFieldType &&
      !this.config.timePartitioningFirestoreField
    ) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: Firestore field name required when field type is specified",
      };
    }

    if (
      this.config.timePartitioningField &&
      !isBuiltInField &&
      !this.config.timePartitioningFirestoreField
    ) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: Firestore field name required for custom field-based partitioning",
      };
    }

    return { proceed: true, message: "" };
  }

  // ========== Private Helper Methods ==========

  private async metaDataSchemaFields(): Promise<TableField[] | null> {
    if (!this.table) return null;

    let metadata: TableMetadata;

    try {
      [metadata] = await this.table.getMetadata();
    } catch {
      console.log("No metadata found");
      return null;
    }

    if (!metadata.schema) return null;
    return metadata.schema.fields;
  }

  private async isTablePartitioned(): Promise<boolean> {
    if (!this.table) return false;

    const [tableExists] = await this.table.exists();
    if (!tableExists) return false;

    const [metadata] = await this.table.getMetadata();
    if (metadata.timePartitioning) {
      logs.cannotPartitionExistingTable(this.table);
      return true;
    }

    const schemaFields = await this.metaDataSchemaFields();
    if (!schemaFields) return false;

    return schemaFields.some(
      (column) => column.name === this.config.timePartitioningField
    );
  }

  private async shouldAddPartitioningToSchema(
    fields: TableField[]
  ): Promise<ValidationResult> {
    if (!this.isPartitioningEnabled()) {
      return { proceed: false, message: "Partitioning not enabled" };
    }

    if (!this.hasValidTableReference()) {
      return { proceed: false, message: "Invalid table reference" };
    }

    if (!this.hasValidCustomPartitionConfig()) {
      return { proceed: false, message: "Invalid partition config" };
    }

    if (!this.hasValidTimePartitionType()) {
      return { proceed: false, message: "Invalid partition type" };
    }

    if (!this.hasValidTimePartitionOption()) {
      return { proceed: false, message: "Invalid partition option" };
    }

    if (this.hasHourAndDatePartitionConfig()) {
      return {
        proceed: false,
        message: "Invalid partitioning and field type combination",
      };
    }

    // Check field-based config
    const hasFieldBasedConfig =
      this.config.timePartitioningFieldType ||
      this.config.timePartitioningFirestoreField;

    if (hasFieldBasedConfig && !this.config.timePartitioningField) {
      return {
        proceed: false,
        message:
          "Partition field name required when using field-based partitioning",
      };
    }

    if (this.config.timePartitioningField && this.customFieldExists(fields)) {
      return { proceed: false, message: "Field already exists on schema" };
    }

    if (await this.isTablePartitioned()) {
      return { proceed: false, message: "Table is already partitioned" };
    }

    return { proceed: true, message: "" };
  }
}

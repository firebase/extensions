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

/**
 * Represents a Firebase Timestamp-like object structure
 */
interface TimestampLike {
  _seconds: number;
  _nanoseconds: number;
}

/**
 * Type guard interface for objects with a toDate method
 */
interface HasToDate {
  toDate(): unknown;
}

/**
 * Result of validation operations
 */
interface ValidationResult {
  proceed: boolean;
  message: string;
}

/**
 * Handles conversion of various date/timestamp formats to BigQuery-compatible strings
 */
class PartitionValueConverter {
  constructor(private fieldType?: string) {}

  /**
   * Converts a value to a BigQuery-compatible date/timestamp string
   * @param value - The value to convert (string, Date, Timestamp, or timestamp-like object)
   * @returns The formatted string for BigQuery, or null if conversion fails
   */
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

  /**
   * Extracts a Date object from various input formats
   * @param value - The value to extract a date from
   * @returns A Date object or null if extraction fails
   */
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

  /**
   * Type guard to check if a value is a timestamp-like object
   * @param value - The value to check
   * @returns True if the value has _seconds and _nanoseconds properties
   */
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

  /**
   * Converts a timestamp-like object to a Firebase Timestamp
   * @param value - The timestamp-like object to convert
   * @returns A Firebase Timestamp or null if conversion fails
   */
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

  /**
   * Type guard to check if a value has a toDate method
   * @param value - The value to check
   * @returns True if the value has a toDate method
   */
  private hasToDateMethod(value: unknown): value is HasToDate {
    return (
      value !== null &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as HasToDate).toDate === "function"
    );
  }

  /**
   * Validates if a value is a valid Date object
   * @param date - The value to validate
   * @returns True if the value is a valid Date
   */
  private isValidDate(date: unknown): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Formats a Date object for BigQuery based on the configured field type
   * @param date - The Date object to format
   * @returns The formatted string for BigQuery
   */
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

/**
 * Manages BigQuery table partitioning configuration and operations
 *
 * This class handles:
 * - Validation of partitioning configurations
 * - Adding partition fields to table schemas
 * - Updating table metadata with partitioning settings
 * - Extracting partition values from Firestore events
 */
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

  /**
   * Checks if the current configuration is valid for partitioning an existing table
   * @returns True if the configuration is valid for partitioning
   */
  async isValidPartitionForExistingTable(): Promise<boolean> {
    if (!this.isPartitioningEnabled()) return false;

    const isPartitioned = await this.isTablePartitioned();
    if (isPartitioned) return false;

    // Use the new validation method
    const validation = this.validatePartitioningConfig();
    return validation.proceed;
  }

  /**
   * Adds a partition field to the table schema if needed
   * @param fields - The existing table fields
   */
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

  /**
   * Determines if table metadata should be updated with partitioning configuration
   * @returns True if metadata should be updated
   */
  async shouldUpdateTableMetadata(): Promise<boolean> {
    if (!this.isPartitioningEnabled()) return false;
    if (!this.hasValidTableReference()) return false;
    if (await this.isTablePartitioned()) return false;

    // Use the new validation method
    const configValidation = this.validatePartitioningConfig();
    if (!configValidation.proceed) {
      if (configValidation.message) {
        functions.logger.warn(configValidation.message);
      }
      return false;
    }

    if (!this.hasValidTimePartitionType()) return false;
    if (!this.hasValidTimePartitionOption()) return false;
    if (this.hasHourAndDatePartitionConfig()) return false;

    return true;
  }

  /**
   * Updates BigQuery table metadata with partitioning configuration
   * @param options - The table metadata options to update
   */
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

  /**
   * Extracts the partition value from a Firestore document change event
   * @param event - The Firestore document change event
   * @returns An object containing the partition field and its value
   */
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

  /**
   * Validates that a table reference exists
   * @returns True if the table reference is valid
   */
  hasValidTableReference(): boolean {
    if (!this.table) {
      logs.invalidTableReference();
    }
    return !!this.table;
  }

  /**
   * Checks if the table has an existing schema
   * @returns True if the table has a schema
   */
  async hasExistingSchema(): Promise<boolean> {
    if (!this.table) return false;
    const [metadata] = await this.table.getMetadata();
    return !!metadata.schema;
  }

  /**
   * Checks if a custom field already exists in the schema
   * @param fields - The table fields to check
   * @returns True if the custom field exists
   */
  customFieldExists(fields: TableField[] = []): boolean {
    const { timePartitioningField } = this.config;
    if (!timePartitioningField) return false;
    return fields.some((field) => field.name === timePartitioningField);
  }

  // ========== Private Validation Methods ==========

  /**
   * Checks if partitioning is enabled in the configuration
   * @returns True if partitioning is enabled
   */
  private isPartitioningEnabled(): boolean {
    const { timePartitioning } = this.config;
    return !!timePartitioning;
  }

  /**
   * Validates the complete partitioning configuration
   *
   * This method checks:
   * - No custom config (default partitioning)
   * - Built-in field configuration
   * - Custom field configuration (requires all three fields)
   *
   * @returns Validation result with proceed flag and error message
   */
  private validatePartitioningConfig(): ValidationResult {
    if (!this.isPartitioningEnabled()) {
      return { proceed: false, message: "Partitioning not enabled" };
    }

    const {
      timePartitioningField,
      timePartitioningFieldType,
      timePartitioningFirestoreField,
    } = this.config;

    // No custom config - valid (default partitioning)
    if (
      !timePartitioningField &&
      !timePartitioningFieldType &&
      !timePartitioningFirestoreField
    ) {
      return { proceed: true, message: "" };
    }

    // Check for invalid field-based configuration
    const hasFieldBasedConfig =
      timePartitioningFieldType || timePartitioningFirestoreField;

    if (hasFieldBasedConfig && !timePartitioningField) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: field name required when using field-based partitioning",
      };
    }

    // Built-in field validation
    if (
      timePartitioningField &&
      BUILT_IN_FIELDS.includes(timePartitioningField as BuiltInField)
    ) {
      // Special case: built-in timestamp field without other configs
      if (
        timePartitioningField === "timestamp" &&
        !timePartitioningFieldType &&
        !timePartitioningFirestoreField
      ) {
        return { proceed: true, message: "" };
      }
      // Built-in fields shouldn't have custom type or firestore field
      if (timePartitioningFieldType || timePartitioningFirestoreField) {
        return {
          proceed: false,
          message:
            "Built-in fields cannot have custom type or Firestore field mapping",
        };
      }
      // Other built-in fields without additional config are valid
      return { proceed: true, message: "" };
    }

    // Custom field validation
    // If field type is missing, it's still valid (will use default)
    if (timePartitioningField && timePartitioningFirestoreField) {
      return { proceed: true, message: "" };
    }

    // All three fields provided - valid
    if (
      timePartitioningField &&
      timePartitioningFieldType &&
      timePartitioningFirestoreField
    ) {
      return { proceed: true, message: "" };
    }

    // Check for missing firestore field when field type is specified
    if (timePartitioningFieldType && !timePartitioningFirestoreField) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: Firestore field name required when field type is specified",
      };
    }

    // Check for missing firestore field for custom fields
    if (
      timePartitioningField &&
      !BUILT_IN_FIELDS.includes(timePartitioningField as BuiltInField) &&
      !timePartitioningFirestoreField
    ) {
      return {
        proceed: false,
        message:
          "Cannot create partitioning: Firestore field name required for custom field-based partitioning",
      };
    }

    // Default case - should not reach here
    return { proceed: true, message: "" };
  }

  /**
   * Validates if the partition type is one of the allowed values
   * @returns True if the partition type is valid
   */
  private hasValidTimePartitionOption(): boolean {
    const { timePartitioning } = this.config;
    return PARTITION_TYPES.includes(timePartitioning as PartitionType);
  }

  /**
   * Validates if the field type is one of the allowed values
   * @returns True if the field type is valid or not specified
   */
  private hasValidTimePartitionType(): boolean {
    const { timePartitioningFieldType } = this.config;

    if (!timePartitioningFieldType || timePartitioningFieldType === undefined) {
      return true;
    }

    return FIELD_TYPES.includes(timePartitioningFieldType as FieldType);
  }

  /**
   * Checks for invalid HOUR partitioning with DATE field type combination
   * @returns True if the configuration has this invalid combination
   */
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

  // ========== Private Helper Methods ==========

  /**
   * Retrieves the schema fields from table metadata
   * @returns Array of table fields or null if not found
   */
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

  /**
   * Checks if the table is already partitioned
   * @returns True if the table has partitioning configured
   */
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

  /**
   * Performs comprehensive validation before adding partitioning to schema
   * @param fields - The existing table fields
   * @returns Validation result indicating if partitioning should be added
   */
  private async shouldAddPartitioningToSchema(
    fields: TableField[]
  ): Promise<ValidationResult> {
    if (!this.isPartitioningEnabled()) {
      return { proceed: false, message: "Partitioning not enabled" };
    }

    if (!this.hasValidTableReference()) {
      return { proceed: false, message: "Invalid table reference" };
    }

    // Use the new validation method
    const configValidation = this.validatePartitioningConfig();
    if (!configValidation.proceed) {
      return configValidation;
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

    if (this.config.timePartitioningField && this.customFieldExists(fields)) {
      return { proceed: false, message: "Field already exists on schema" };
    }

    if (await this.isTablePartitioned()) {
      return { proceed: false, message: "Table is already partitioned" };
    }

    return { proceed: true, message: "" };
  }
}

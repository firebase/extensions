import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import { ChangeType, FirestoreDocumentChangeEvent } from "..";
import * as firebase from "firebase-admin";

import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";
import * as functions from "firebase-functions";
import { getNewPartitionField } from "./schema";
import { BigQuery, TableMetadata } from "@google-cloud/bigquery";
import { PartitionFieldType } from "../types";

export class Partitioning {
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

  private isPartitioningEnabled(): boolean {
    const { timePartitioning } = this.config;

    return !!timePartitioning;
  }

  private isValidPartitionTypeString(value) {
    return typeof value === "string";
  }

  private async metaDataSchemaFields() {
    let metadata: TableMetadata;

    try {
      [metadata] = await this.table.getMetadata();
    } catch {
      console.log("No metadata found");
      return null;
    }

    /** Return null if no valid schema on table **/
    if (!metadata.schema) return null;

    return metadata.schema.fields;
  }

  private isValidPartitionTypeDate(value) {
    /* Check if valid timestamp value from sdk */
    if (value instanceof firebase.firestore.Timestamp) return true;

    /* Check if it looks like a timestamp object */
    if (isTimestampLike(value)) {
      // But also check if it can be converted successfully
      const converted = convertToTimestamp(value);
      return converted !== null;
    }

    /* Check if valid date/timestamp with toDate method */
    if (value && value.toDate && typeof value.toDate === "function") {
      try {
        const date = value.toDate();
        return date instanceof Date && !isNaN(date.getTime());
      } catch {
        return false;
      }
    }

    /* Check if valid date object */
    if (Object.prototype.toString.call(value) === "[object Date]") {
      return !isNaN(value.getTime());
    }

    return false;
  }

  private hasHourAndDatePartitionConfig() {
    if (
      this.config.timePartitioning === "HOUR" &&
      this.config.timePartitioningFieldType === "DATE"
    ) {
      logs.hourAndDatePartitioningWarning();
      return true;
    }

    return false;
  }

  private hasValidCustomPartitionConfig() {
    /* Return false if partition type option has not been set*/
    if (!this.isPartitioningEnabled()) return false;

    return true;
  }

  private hasValidTimePartitionOption() {
    const { timePartitioning } = this.config;

    return ["HOUR", "DAY", "MONTH", "YEAR"].includes(timePartitioning);
  }

  private hasValidTimePartitionType() {
    const { timePartitioningFieldType } = this.config;

    if (!timePartitioningFieldType || timePartitioningFieldType === undefined)
      return true;

    return ["TIMESTAMP", "DATE", "DATETIME"].includes(
      timePartitioningFieldType
    );
  }

  async hasExistingSchema() {
    const [metadata] = await this.table.getMetadata();
    return !!metadata.schema;
  }

  hasValidTableReference() {
    if (!this.table) {
      logs.invalidTableReference();
    }
    return !!this.table;
  }

  private async isTablePartitioned() {
    const [tableExists] = await this.table.exists();

    if (!this.table || !tableExists) return false;

    /* Return true if partition metadata already exists */
    const [metadata] = await this.table.getMetadata();
    if (metadata.timePartitioning) {
      logs.cannotPartitionExistingTable(this.table);
      return true;
    }

    /** Find schema fields **/
    const schemaFields = await this.metaDataSchemaFields();

    /** Return false if no schema exists */
    if (!schemaFields) return false;

    /* Return false if time partition field not found */
    return schemaFields.some(
      (column) => column.name === this.config.timePartitioningField
    );
  }

  async isValidPartitionForExistingTable(): Promise<boolean> {
    /** Return false if partition type option has not been set */
    if (!this.isPartitioningEnabled()) return false;

    /* Return false if table is already partitioned */
    const isPartitioned = await this.isTablePartitioned();
    if (isPartitioned) return false;

    return this.hasValidCustomPartitionConfig();
  }

  convertDateValue(fieldValue: Date): string {
    const { timePartitioningFieldType } = this.config;

    /* Return as Datetime value */
    if (timePartitioningFieldType === PartitionFieldType.DATETIME) {
      return BigQuery.datetime(fieldValue.toISOString()).value;
    }

    /* Return as Date value */
    if (timePartitioningFieldType === PartitionFieldType.DATE) {
      return BigQuery.date(fieldValue.toISOString().substring(0, 10)).value;
    }

    /* Return as Timestamp  */
    return BigQuery.timestamp(fieldValue).value;
  }

  /*
    Extracts a valid Partition field from the Document Change Event.
    Matches result based on a pre-defined Firestore field matching the event data object.
    Return an empty object if no field name or value provided. 
    Returns empty object if not a string or timestamp (or result of serializing a timestamp)
    Logs warning if not a valid datatype
    Delete changes events have no data, return early as cannot partition on empty data.
  **/
  getPartitionValue(event: FirestoreDocumentChangeEvent) {
    // When old data is disabled and the operation is delete
    // the data and old data will be null
    if (event.data == null && event.oldData == null) return {};

    const firestoreFieldName = this.config.timePartitioningFirestoreField;
    const fieldName = this.config.timePartitioningField;
    const fieldValue =
      event.operation === ChangeType.DELETE
        ? event.oldData[firestoreFieldName]
        : event.data[firestoreFieldName];

    if (!fieldName || !fieldValue) {
      return {};
    }

    if (this.isValidPartitionTypeString(fieldValue)) {
      return { [fieldName]: fieldValue };
    }

    if (this.isValidPartitionTypeDate(fieldValue)) {
      /* Return converted console value */
      if (isTimestampLike(fieldValue)) {
        const convertedTimestampFieldValue = convertToTimestamp(fieldValue);

        // If conversion failed, log error and return empty object
        if (!convertedTimestampFieldValue) {
          logs.firestoreTimePartitionFieldError(
            event.documentName,
            fieldName,
            firestoreFieldName,
            fieldValue
          );
          return {};
        }

        try {
          const dateValue = convertedTimestampFieldValue.toDate();

          // Check if the resulting date is valid
          if (!isFinite(dateValue.getTime())) {
            logs.firestoreTimePartitionFieldError(
              event.documentName,
              fieldName,
              firestoreFieldName,
              fieldValue
            );
            return {};
          }

          return {
            [fieldName]: this.convertDateValue(dateValue),
          };
        } catch (error) {
          logs.firestoreTimePartitionFieldError(
            event.documentName,
            fieldName,
            firestoreFieldName,
            fieldValue
          );
          return {};
        }
      }

      if (fieldValue.toDate) {
        try {
          const dateValue = fieldValue.toDate();

          // Check if the date is valid
          if (!isFinite(dateValue.getTime())) {
            logs.firestoreTimePartitionFieldError(
              event.documentName,
              fieldName,
              firestoreFieldName,
              fieldValue
            );
            return {};
          }

          return { [fieldName]: this.convertDateValue(dateValue) };
        } catch (error) {
          // Handle cases where toDate() throws
          logs.firestoreTimePartitionFieldError(
            event.documentName,
            fieldName,
            firestoreFieldName,
            fieldValue
          );
          return {};
        }
      }

      /* Return standard date value */
      if (fieldValue instanceof Date) {
        // Check if it's a valid date
        if (!isFinite(fieldValue.getTime())) {
          logs.firestoreTimePartitionFieldError(
            event.documentName,
            fieldName,
            firestoreFieldName,
            fieldValue
          );
          return {};
        }
        return { [fieldName]: this.convertDateValue(fieldValue) };
      }

      return { [fieldName]: fieldValue };
    }

    logs.firestoreTimePartitionFieldError(
      event.documentName,
      fieldName,
      firestoreFieldName,
      fieldValue
    );

    return {};
  }

  customFieldExists(fields = []) {
    /** Extract the time partioning field name */
    const { timePartitioningField } = this.config;

    /** Return based the field already exist */
    return fields.map(($) => $.name).includes(timePartitioningField);
  }

  private async shouldAddPartitioningToSchema(fields: string[]): Promise<{
    proceed: boolean;
    message: string;
  }> {
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

    // Only check for field name if other field-based config is provided
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

    // Only check if field exists when we have a field name
    if (this.config.timePartitioningField && this.customFieldExists(fields)) {
      return { proceed: false, message: "Field already exists on schema" };
    }

    if (await this.isTablePartitioned()) {
      return { proceed: false, message: "Table is already partitioned" };
    }

    return { proceed: true, message: "" };
  }

  async addPartitioningToSchema(fields = []): Promise<void> {
    // Only proceed if we should add a custom partition field
    if (!this.config.timePartitioningField) {
      // This is ingestion-time partitioning, no field to add
      return;
    }

    const { proceed, message } = await this.shouldAddPartitioningToSchema(
      fields
    );

    if (!proceed) {
      functions.logger.warn(`Did not add partitioning to schema: ${message}`);
      return;
    }

    // Add new partitioning field
    const newField = getNewPartitionField(this.config);
    if (newField) {
      fields.push(newField);
      functions.logger.log(
        `Added new partition field: ${this.config.timePartitioningField} to table ID: ${this.table.id}`
      );
    }
  }

  async updateTableMetadata(options: bigquery.TableMetadata): Promise<void> {
    /** Return if partition type option has not been set */
    if (!this.isPartitioningEnabled()) return;

    /** Return if class has invalid table reference */
    if (!this.hasValidTableReference()) return;

    /** Return if table is already partitioned **/
    if (await this.isTablePartitioned()) return;

    /** Return if an invalid partition type has been requested**/
    if (!this.hasValidCustomPartitionConfig()) return;

    /** Return if an invalid partition type has been requested**/
    if (!this.hasValidTimePartitionType()) return;

    /** Update fields with new schema option ** */
    if (!this.hasValidTimePartitionOption()) return;

    /** Return if invalid partitioning and field type combination */
    if (this.hasHourAndDatePartitionConfig()) return;

    // Check for invalid field-based configuration
    const hasFieldBasedConfig =
      this.config.timePartitioningFieldType ||
      this.config.timePartitioningFirestoreField;

    if (hasFieldBasedConfig && !this.config.timePartitioningField) {
      // Invalid configuration - don't set any partitioning
      functions.logger.warn(
        "Cannot create partitioning: field name required when using field-based partitioning"
      );
      return;
    }

    // Special handling for built-in fields that don't require Firestore field mapping
    const BUILT_IN_FIELDS = [
      "timestamp",
      "document_name",
      "event_id",
      "operation",
    ];
    const isBuiltInField =
      this.config.timePartitioningField &&
      BUILT_IN_FIELDS.includes(this.config.timePartitioningField);

    // If timePartitioningFieldType is explicitly set, it indicates the user wants
    // field-based partitioning with a specific type, which requires a Firestore field
    // This applies even to built-in fields when field type is specified
    if (
      this.config.timePartitioningFieldType &&
      !this.config.timePartitioningFirestoreField
    ) {
      functions.logger.warn(
        "Cannot create partitioning: Firestore field name required when field type is specified"
      );
      return;
    }

    // For custom fields (non-built-in), we always need the Firestore field name
    if (
      this.config.timePartitioningField &&
      !isBuiltInField &&
      !this.config.timePartitioningFirestoreField
    ) {
      // This is field-based partitioning with a custom field but missing the Firestore field
      functions.logger.warn(
        "Cannot create partitioning: Firestore field name required for custom field-based partitioning"
      );
      return;
    }

    // All checks passed, now we can set up partitioning
    if (this.config.timePartitioning) {
      options.timePartitioning = { type: this.config.timePartitioning };
    }
    //TODO: Add check for skipping adding views partition field, this is not a feature that can be added .

    // Only set field if we have one (field-based partitioning)
    if (this.config.timePartitioningField) {
      options.timePartitioning = {
        ...options.timePartitioning,
        field: this.config.timePartitioningField,
      };
    }
  }
}

type TimestampLike = {
  _seconds: number;
  _nanoseconds: number;
};

const isTimestampLike = (value: any): value is TimestampLike => {
  if (value instanceof firebase.firestore.Timestamp) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    typeof value["_seconds"] === "number" &&
    "_nanoseconds" in value &&
    typeof value["_nanoseconds"] === "number"
  );
};

const convertToTimestamp = (
  value: TimestampLike
): firebase.firestore.Timestamp | null => {
  if (value instanceof firebase.firestore.Timestamp) return value;

  try {
    // Check if seconds is a valid number (not NaN, not infinity)
    if (!Number.isFinite(value._seconds)) {
      console.warn(
        "Invalid seconds value in timestamp conversion:",
        value._seconds
      );
      return null;
    }

    // Check if nanoseconds is a valid number
    if (!Number.isFinite(value._nanoseconds)) {
      console.warn(
        "Invalid nanoseconds value in timestamp conversion:",
        value._nanoseconds
      );
      return null;
    }

    return new firebase.firestore.Timestamp(value._seconds, value._nanoseconds);
  } catch (error) {
    console.warn("Failed to convert to Firebase Timestamp:", error);
    return null;
  }
};

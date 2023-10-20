import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import { FirestoreDocumentChangeEvent } from "..";
import * as firebase from "firebase-admin";

import * as logs from "../logs";
import * as bigquery from "@google-cloud/bigquery";

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

    /* Check if valid date/timstemap, expedted result from production  */
    if (value && value.toDate && value.toDate()) return true;

    /* Check if valid date/time value from the console, expected result from testing locally */
    return Object.prototype.toString.call(value) === "[object Date]";
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

    const {
      timePartitioningField,
      timePartitioningFieldType,
      timePartitioningFirestoreField,
    } = this.config;

    const hasNoCustomOptions =
      !timePartitioningField &&
      !timePartitioningFieldType &&
      !timePartitioningFirestoreField;

    /* No custom config has been set, use partition value option only */
    if (hasNoCustomOptions) return true;

    /* check if all options have been provided to be  */
    return (
      !!timePartitioningField &&
      !!timePartitioningFieldType &&
      !!timePartitioningFirestoreField
    );
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
    logs.invalidTableReference();
    return !!this.table;
  }

  private async isTablePartitioned() {
    if (!this.table) return Promise.resolve(false);
    // No table provided, cannot evaluate
    if (this.table.exists()) {
      logs.cannotPartitionExistingTable(this.table);
      return Promise.resolve(false);
    }

    /*** No table exists, return */
    const [tableExists] = await this.table.exists();
    if (!tableExists) return Promise.resolve(false);

    /* Check if partition metadata already exists */
    const [metadata] = await this.table.getMetadata();
    if (!!metadata.timePartitioning) return Promise.resolve(true);

    /** Find schema fields **/
    const schemaFields = await this.metaDataSchemaFields();

    /** No Schema exists, return */
    if (!schemaFields) return Promise.resolve(false);

    /* Return false if time partition field not found */
    return schemaFields.some(
      (column) => column.name === this.config.timePartitioningField
    );
  }

  async isValidPartitionForExistingTable(): Promise<boolean> {
    const isPartitioned = await this.isTablePartitioned();
    if (isPartitioned) return Promise.resolve(false);

    return this.hasValidCustomPartitionConfig();
  }

  isValidPartitionForNewTable(): boolean {
    if (!this.isPartitioningEnabled()) return false;

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
    Returns empty object if not a string or timestamp
    Logs warning if not a valid datatype
    Delete changes events have no data, return early as cannot partition on empty data.
  **/
  getPartitionValue(event: FirestoreDocumentChangeEvent) {
    if (!event.data) return {};

    const firestoreFieldName = this.config.timePartitioningFirestoreField;
    const fieldName = this.config.timePartitioningField;
    const fieldValue = event.data[firestoreFieldName];

    if (!fieldName || !fieldValue) {
      return {};
    }

    if (this.isValidPartitionTypeString(fieldValue)) {
      return { [fieldName]: fieldValue };
    }

    if (this.isValidPartitionTypeDate(fieldValue)) {
      /* Return converted console value */
      if (fieldValue.toDate) {
        return { [fieldName]: this.convertDateValue(fieldValue.toDate()) };
      }

      /* Return standard date value */
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
    if (!fields.length) return false;

    const { timePartitioningField } = this.config;

    return fields.map(($) => $.name).includes(timePartitioningField);
  }

  async addPartitioningToSchema(fields = []): Promise<void> {
    /** check if class has valid table reference */
    if (!this.hasValidTableReference()) return Promise.resolve();

    /** return if table is already partitioned **/
    if (await this.isTablePartitioned()) return Promise.resolve();

    /** return if an invalid partition type has been requested**/
    if (!this.hasValidTimePartitionType()) return Promise.resolve();

    /** Return if invalid partitioning and field type combination */
    if (this.hasHourAndDatePartitionConfig()) return Promise.resolve();

    /** return if an invalid partition type has been requested**/
    if (!this.hasValidCustomPartitionConfig()) return Promise.resolve();

    /** return if an invalid partition type has been requested**/
    if (!this.hasValidCustomPartitionConfig()) return Promise.resolve();

    /** update fields with new schema option ** */
    if (!this.hasValidTimePartitionOption()) return Promise.resolve();

    /* Check if partition field has been provided */
    if (!this.config.timePartitioningField) return Promise.resolve();

    // if (await !this.hasExistingSchema) return Promise.resolve();

    // Field already exists on schema, skip
    if (this.customFieldExists(fields)) return Promise.resolve();

    fields.push(getNewPartitionField(this.config));

    /** log successful addition of partition column */
    logs.addPartitionFieldColumn(
      this.table.id,
      this.config.timePartitioningField
    );

    return Promise.resolve();
  }

  async updateTableMetadata(options: bigquery.TableMetadata): Promise<void> {
    /** return if table is already partitioned **/
    if (await this.isTablePartitioned()) return Promise.resolve();

    /** return if an invalid partition type has been requested**/
    if (!this.hasValidTimePartitionType()) return Promise.resolve();

    /** update fields with new schema option ** */
    if (!this.hasValidTimePartitionOption()) return Promise.resolve();

    /** Return if invalid partitioning and field type combination */
    if (this.hasHourAndDatePartitionConfig()) return Promise.resolve();

    /** return if an invalid partition type has been requested**/
    if (!this.hasValidCustomPartitionConfig()) return Promise.resolve();

    // if (await !this.hasExistingSchema) return Promise.resolve();

    if (this.config.timePartitioning) {
      options.timePartitioning = { type: this.config.timePartitioning };
    }

    //TODO: Add check for skipping adding views partition field, this is not a feature that can be added .

    if (this.config.timePartitioningField) {
      options.timePartitioning = {
        ...options.timePartitioning,
        field: this.config.timePartitioningField,
      };
    }
  }
}

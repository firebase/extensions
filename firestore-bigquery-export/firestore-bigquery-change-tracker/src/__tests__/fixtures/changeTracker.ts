import { firestore } from "firebase-admin";
import { ChangeType, FirestoreDocumentChangeEvent } from "../..";
import {
  FirestoreBigQueryEventHistoryTracker,
  FirestoreBigQueryEventHistoryTrackerConfig,
} from "../../bigquery";

/**
 * Builder class for creating FirestoreBigQueryEventHistoryTracker instances with valid configurations.
 * Uses a fluent interface to ensure type-safe configuration that passes Zod validation.
 */
export class ChangeTrackerBuilder {
  private config: Partial<FirestoreBigQueryEventHistoryTrackerConfig> = {};

  constructor() {
    // Set required defaults
    this.config.datasetId = "test_dataset";
    this.config.tableId = "test_table";
  }

  /**
   * Set basic configuration properties
   */
  withDatasetId(datasetId: string): this {
    this.config.datasetId = datasetId;
    return this;
  }

  withTableId(tableId: string): this {
    this.config.tableId = tableId;
    return this;
  }

  withDatasetLocation(location: string): this {
    this.config.datasetLocation = location;
    return this;
  }

  withClustering(fields: string[]): this {
    this.config.clustering = fields;
    return this;
  }

  withWildcardIds(enabled: boolean): this {
    this.config.wildcardIds = enabled;
    return this;
  }

  withBqProjectId(projectId: string): this {
    this.config.bqProjectId = projectId;
    return this;
  }

  withTransformFunction(functionUrl: string): this {
    this.config.transformFunction = functionUrl;
    return this;
  }

  withNewSnapshotQuerySyntax(enabled: boolean): this {
    this.config.useNewSnapshotQuerySyntax = enabled;
    return this;
  }

  withMaterializedView(enabled: boolean): this {
    this.config.useMaterializedView = enabled;
    return this;
  }

  withIncrementalMaterializedView(enabled: boolean): this {
    this.config.useIncrementalMaterializedView = enabled;
    return this;
  }

  withSkipInit(skip: boolean): this {
    this.config.skipInit = skip;
    return this;
  }

  withBackupTableId(tableId: string): this {
    this.config.backupTableId = tableId;
    return this;
  }

  withKmsKeyName(keyName: string): this {
    this.config.kmsKeyName = keyName;
    return this;
  }

  withLogLevel(level: "debug" | "info" | "warn" | "error" | "silent"): this {
    this.config.logLevel = level;
    return this;
  }

  /**
   * Configure for no partitioning (Shape 1)
   */
  withNoPartitioning(): this {
    // Clear any existing partitioning config
    delete this.config.timePartitioning;
    delete this.config.timePartitioningColumn;
    delete this.config.timePartitioningFieldType;
    delete this.config.timePartitioningFirestoreField;
    return this;
  }

  /**
   * Configure for no partitioning with explicit NONE value
   */
  withPartitioningNone(): this {
    this.withNoPartitioning();
    this.config.timePartitioning = "NONE";
    return this;
  }

  /**
   * Configure for ingestion-time partitioning (Shape 2)
   */
  withIngestionTimePartitioning(
    granularity: "HOUR" | "DAY" | "MONTH" | "YEAR"
  ): this {
    // Clear any existing partitioning config
    delete this.config.timePartitioningColumn;
    delete this.config.timePartitioningFieldType;
    delete this.config.timePartitioningFirestoreField;

    this.config.timePartitioning = granularity;
    return this;
  }

  /**
   * Configure for timestamp column partitioning (Shape 3)
   */
  withTimestampPartitioning(
    granularity: "HOUR" | "DAY" | "MONTH" | "YEAR"
  ): this {
    // Clear any existing partitioning config
    delete this.config.timePartitioningFieldType;
    delete this.config.timePartitioningFirestoreField;

    this.config.timePartitioning = granularity;
    this.config.timePartitioningColumn = "timestamp";
    return this;
  }

  /**
   * Configure for custom field partitioning (Shape 4)
   * All parameters are required for valid field partitioning
   */
  withFieldPartitioning(
    granularity: "HOUR" | "DAY" | "MONTH" | "YEAR",
    columnName: string,
    fieldType: "TIMESTAMP" | "DATE" | "DATETIME",
    firestoreField: string
  ): this {
    this.config.timePartitioning = granularity;
    this.config.timePartitioningColumn = columnName;
    this.config.timePartitioningFieldType = fieldType;
    this.config.timePartitioningFirestoreField = firestoreField;
    return this;
  }

  /**
   * Configure with partial/invalid partitioning for testing error cases
   * This will likely fail Zod validation, which is useful for error testing
   */
  withInvalidPartitioning(config: {
    timePartitioning?: string;
    timePartitioningColumn?: string | null;
    timePartitioningFieldType?: string;
    timePartitioningFirestoreField?: string;
  }): this {
    if (config.timePartitioning !== undefined) {
      this.config.timePartitioning = config.timePartitioning as any;
    }
    if (config.timePartitioningColumn !== undefined) {
      this.config.timePartitioningColumn = config.timePartitioningColumn as any;
    }
    if (config.timePartitioningFieldType !== undefined) {
      this.config.timePartitioningFieldType =
        config.timePartitioningFieldType as any;
    }
    if (config.timePartitioningFirestoreField !== undefined) {
      this.config.timePartitioningFirestoreField =
        config.timePartitioningFirestoreField;
    }
    return this;
  }

  /**
   * Build the final FirestoreBigQueryEventHistoryTracker instance
   */
  build(): FirestoreBigQueryEventHistoryTracker {
    // Set defaults if not explicitly set
    if (!this.config.bqProjectId) {
      this.config.bqProjectId =
        process.env.PROJECT_ID || "dev-extensions-testing";
    }

    // Log the final config for debugging
    console.log("Building tracker with config:", this.config);

    return new FirestoreBigQueryEventHistoryTracker(
      this.config as FirestoreBigQueryEventHistoryTrackerConfig
    );
  }
}

/**
 * Factory function for creating a new ChangeTrackerBuilder
 */
export const changeTracker = (): ChangeTrackerBuilder => {
  return new ChangeTrackerBuilder();
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use changeTracker().withXXX().build() instead
 */
export const createChangeTracker = (
  overrides: Partial<FirestoreBigQueryEventHistoryTrackerConfig> = {}
): FirestoreBigQueryEventHistoryTracker => {
  const builder = new ChangeTrackerBuilder();

  // Apply all overrides
  Object.assign(builder["config"], overrides);

  // Handle partitioning based on what's provided
  if (
    overrides.timePartitioningColumn !== undefined &&
    overrides.timePartitioningColumn !== "timestamp" &&
    overrides.timePartitioningFieldType !== undefined &&
    overrides.timePartitioningFirestoreField !== undefined
  ) {
    // Field partitioning - ensure all 4 fields are present
    if (!overrides.timePartitioning) {
      builder["config"].timePartitioning = "DAY";
    }
  }

  return builder.build();
};

/**
 * Creates a mock FirestoreDocumentChangeEvent for testing.
 *
 * @param {Partial<FirestoreDocumentChangeEvent>} overrides -
 * Event properties to override the defaults.
 * @returns {FirestoreDocumentChangeEvent} A mock event object.
 */
export const changeTrackerEvent = (
  overrides: Partial<FirestoreDocumentChangeEvent> = {}
): FirestoreDocumentChangeEvent => {
  const baseEvent: FirestoreDocumentChangeEvent = {
    timestamp: "2022-02-13T10:17:43.505Z",
    operation: ChangeType.CREATE,
    documentName: "testing",
    eventId: "testing",
    documentId: "testing",
    pathParams: { documentId: "12345" },
    data: { end_date: firestore.Timestamp.now() },
    oldData: undefined, // oldData is often undefined for CREATE events
  };

  return {
    ...baseEvent,
    ...overrides,
  };
};

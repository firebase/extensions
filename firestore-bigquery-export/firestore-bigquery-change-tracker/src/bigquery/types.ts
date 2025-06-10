import { z } from "zod";

/**
 * This is the shared base for all configuration variants. It includes all
 * parameters that are not dependent on the partitioning strategy.
 */
const BaseConfigSchema = z.object({
  datasetId: z.string(),
  tableId: z.string(),
  firestoreInstanceId: z.string().optional(),
  datasetLocation: z.string().optional(),
  transformFunction: z.string().optional(),
  clustering: z.array(z.string()).nullable(),
  databaseId: z.string().optional(),
  wildcardIds: z.boolean().optional(),
  bqProjectId: z.string().optional(),
  backupTableId: z.string().optional(),
  useNewSnapshotQuerySyntax: z.boolean().optional(),
  skipInit: z.boolean().optional(),
  kmsKeyName: z.string().optional(),
  useMaterializedView: z.boolean().optional(),
  useIncrementalMaterializedView: z.boolean().optional(),
  maxStaleness: z.string().optional(),
  refreshIntervalMinutes: z.number().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
});

/**
 * Shape 1: No partitioning.
 * `timePartitioning` can be null, undefined, or the string "NONE".
 * All other partitioning-related fields must be undefined.
 */
const NoPartitioningSchema = BaseConfigSchema.extend({
  timePartitioning: z.union([z.null(), z.undefined(), z.literal("NONE")]),
  timePartitioningColumn: z.undefined(),
  timePartitioningFieldType: z.undefined(),
  timePartitioningFirestoreField: z.undefined(),
});

/**
 * Shape 2: Ingestion-time partitioning.
 * `timePartitioning` must be one of the valid granularities.
 * All other partitioning-related fields must be undefined.
 */
const IngestionTimePartitioningSchema = BaseConfigSchema.extend({
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
  timePartitioningColumn: z.undefined(),
  timePartitioningFieldType: z.undefined(),
  timePartitioningFirestoreField: z.undefined(),
});

/**
 * Shape 3: Timestamp column partitioning.
 * Uses the built-in `timestamp` column.
 * All other partitioning-related fields must be undefined.
 */
const TimestampPartitioningSchema = BaseConfigSchema.extend({
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
  timePartitioningColumn: z.literal("timestamp"),
  timePartitioningFieldType: z.undefined(),
  timePartitioningFirestoreField: z.undefined(),
});

/**
 * Shape 4: Custom field partitioning.
 * All four partitioning-related fields are mandatory.
 */
const FieldPartitioningSchema = BaseConfigSchema.extend({
  timePartitioning: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]),
  timePartitioningColumn: z.string().min(1),
  timePartitioningFieldType: z.enum(["TIMESTAMP", "DATE", "DATETIME"]),
  timePartitioningFirestoreField: z.string().min(1),
});

/**
 * Creates the final public schema by unioning the 4 valid shapes.
 * This allows Zod to validate that a given config object matches one, and only one,
 * of the valid partitioning strategies.
 */
export const FirestoreBigQueryConfigSchema = z.union([
  NoPartitioningSchema,
  IngestionTimePartitioningSchema,
  TimestampPartitioningSchema,
  FieldPartitioningSchema,
]);

/**
 * The inferred TypeScript type for the configuration.
 */
export type FirestoreBigQueryEventHistoryTrackerConfig = z.infer<
  typeof FirestoreBigQueryConfigSchema
>;

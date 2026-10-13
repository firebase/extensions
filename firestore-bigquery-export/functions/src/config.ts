/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { LogLevel } from "@firebaseextensions/firestore-bigquery-change-tracker";
import type {
  ChangeTrackerConfig,
  PartitioningFieldType,
  TimePartitioningGranularity,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
type TrackerLogLevel = "debug" | "info" | "warn" | "error" | "silent";

function timePartitioning(
  type: string | undefined
): TimePartitioningGranularity | null {
  if (
    type === "HOUR" ||
    type === "DAY" ||
    type === "MONTH" ||
    type === "YEAR"
  ) {
    return type;
  }

  return null;
}

export function clustering(clusters: string | undefined) {
  return clusters ? clusters.split(",").slice(0, 4) : null;
}

function normalizeOptionalPartitionValue(
  value: string | undefined
): string | undefined {
  const normalized = value?.trim();

  if (!normalized || normalized === "NONE" || normalized === "omit") {
    return undefined;
  }

  return normalized;
}

function normalizePartitionFieldType(
  value: string | undefined
): PartitioningFieldType | undefined {
  const normalized = normalizeOptionalPartitionValue(value);
  if (
    normalized === "TIMESTAMP" ||
    normalized === "DATE" ||
    normalized === "DATETIME"
  ) {
    return normalized;
  }
  return undefined;
}

export function buildPartitioningConfig(params: {
  timePartitioning: TimePartitioningGranularity | null;
  timePartitioningField: string | undefined;
  timePartitioningFieldType: string | undefined;
  timePartitioningFirestoreField: string | undefined;
}): ChangeTrackerConfig["partitioning"] {
  const { timePartitioning } = params;
  const rawFieldName = params.timePartitioningField?.trim();
  const rawFieldType = params.timePartitioningFieldType?.trim();
  const rawFirestoreField = params.timePartitioningFirestoreField?.trim();

  const formatValue = (value: string | undefined): string =>
    value && value.length > 0 ? `"${value}"` : "(empty)";

  const throwInvalidPartitioningConfig = (detail: string): never => {
    throw new Error(
      [
        "Invalid partitioning configuration for firestore-bigquery-export.",
        detail,
        `Received TABLE_PARTITIONING=${formatValue(
          timePartitioning ?? undefined
        )},`,
        `TIME_PARTITIONING_FIELD=${formatValue(rawFieldName)},`,
        `TIME_PARTITIONING_FIRESTORE_FIELD=${formatValue(rawFirestoreField)},`,
        `TIME_PARTITIONING_FIELD_TYPE=${formatValue(rawFieldType)}.`,
        "Valid combinations are:",
        "1) Ingestion-time: TABLE_PARTITIONING set and all TIME_PARTITIONING_* values empty/NONE/omit.",
        "2) Timestamp field: TABLE_PARTITIONING set, TIME_PARTITIONING_FIELD=timestamp, TIME_PARTITIONING_FIRESTORE_FIELD empty.",
        "3) Custom field: TABLE_PARTITIONING set, and TIME_PARTITIONING_FIELD + TIME_PARTITIONING_FIRESTORE_FIELD + TIME_PARTITIONING_FIELD_TYPE all provided.",
      ].join(" ")
    );
  };

  const fieldName = normalizeOptionalPartitionValue(
    params.timePartitioningField
  );
  const fieldType = normalizePartitionFieldType(
    params.timePartitioningFieldType
  );
  const firestoreField = normalizeOptionalPartitionValue(
    params.timePartitioningFirestoreField
  );

  if (!timePartitioning) {
    if (fieldName || fieldType || firestoreField) {
      return throwInvalidPartitioningConfig(
        "Partition-specific fields cannot be provided when TABLE_PARTITIONING is NONE."
      );
    }
    return { granularity: "NONE" };
  }

  if (!fieldName && !firestoreField) {
    return { granularity: timePartitioning };
  }

  if (fieldName === "timestamp" && !firestoreField) {
    return {
      granularity: timePartitioning,
      bigqueryColumnName: "timestamp",
      ...(fieldType ? { bigqueryColumnType: fieldType } : {}),
    };
  }

  if (fieldName && firestoreField && fieldType) {
    return {
      granularity: timePartitioning,
      bigqueryColumnName: fieldName,
      bigqueryColumnType: fieldType,
      firestoreFieldName: firestoreField,
    };
  }

  return throwInvalidPartitioningConfig(
    "When TABLE_PARTITIONING is set, partitioning fields are either incomplete or invalid."
  );
}

function normalizeLogLevel(level: string | undefined): TrackerLogLevel {
  switch ((level || "").toLowerCase()) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
      return "error";
    case "silent":
      return "silent";
    default:
      return LogLevel.INFO;
  }
}

export default {
  bqProjectId: process.env.BIGQUERY_PROJECT_ID,
  projectId: process.env.PROJECT_ID,
  databaseId: process.env.DATABASE || "(default)",
  databaseRegion: process.env.DATABASE_REGION,
  collectionPath: process.env.COLLECTION_PATH,
  datasetId: process.env.DATASET_ID,
  tableId: process.env.TABLE_ID,
  location: process.env.LOCATION,
  initialized: false,
  importCollectionPath: process.env.IMPORT_COLLECTION_PATH,
  datasetLocation: process.env.DATASET_LOCATION,
  backupCollectionId: process.env.BACKUP_COLLECTION,
  transformFunction: process.env.TRANSFORM_FUNCTION,
  timePartitioning: timePartitioning(process.env.TABLE_PARTITIONING),
  timePartitioningField: process.env.TIME_PARTITIONING_FIELD,
  timePartitioningFieldType:
    process.env.TIME_PARTITIONING_FIELD_TYPE !== "omit"
      ? process.env.TIME_PARTITIONING_FIELD_TYPE
      : undefined,
  timePartitioningFirestoreField: process.env.TIME_PARTITIONING_FIRESTORE_FIELD,
  partitioning: buildPartitioningConfig({
    timePartitioning: timePartitioning(process.env.TABLE_PARTITIONING),
    timePartitioningField: process.env.TIME_PARTITIONING_FIELD,
    timePartitioningFieldType: process.env.TIME_PARTITIONING_FIELD_TYPE,
    timePartitioningFirestoreField:
      process.env.TIME_PARTITIONING_FIRESTORE_FIELD,
  }),
  clustering: clustering(process.env.CLUSTERING),
  wildcardIds: process.env.WILDCARD_IDS === "true",
  useNewSnapshotQuerySyntax:
    process.env.USE_NEW_SNAPSHOT_QUERY_SYNTAX === "yes" ? true : false,
  excludeOldData: process.env.EXCLUDE_OLD_DATA === "yes" ? true : false,
  viewType: process.env.VIEW_TYPE || "view",
  maxStaleness: process.env.MAX_STALENESS,
  refreshIntervalMinutes: process.env.REFRESH_INTERVAL_MINUTES
    ? parseInt(process.env.REFRESH_INTERVAL_MINUTES)
    : undefined,
  instanceId: process.env.EXT_INSTANCE_ID!,
  maxDispatchesPerSecond: parseInt(
    process.env.MAX_DISPATCHES_PER_SECOND || "10"
  ),
  kmsKeyName: process.env.KMS_KEY_NAME,
  maxEnqueueAttempts: isNaN(parseInt(process.env.MAX_ENQUEUE_ATTEMPTS))
    ? 3
    : parseInt(process.env.MAX_ENQUEUE_ATTEMPTS),
  // backup bucket defaults to default firebase cloud storage bucket
  backupToGCS: process.env.BACKUP_TO_GCS === "yes" ? true : false,
  backupBucketName:
    process.env.BACKUP_GCS_BUCKET || `${process.env.PROJECT_ID}.appspot.com`,
  backupDir: `_${process.env.INSTANCE_ID || "firestore-bigquery-export"}`,
  logLevel: normalizeLogLevel(process.env.LOG_LEVEL),
};

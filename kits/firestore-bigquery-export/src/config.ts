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

import type {
  ChangeTrackerConfig,
  PartitioningFieldType,
  TimePartitioningGranularity,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import { LogLevel } from "@firebaseextensions/firestore-bigquery-change-tracker";
import type { Expression } from "firebase-functions/params";
import {
  defineBoolean,
  defineString,
  projectID,
  select,
} from "firebase-functions/params";
import type { ExportConfig, ViewType } from "./export-config";

type TrackerLogLevel = "debug" | "info" | "warn" | "error" | "silent";
type ConfigExpression<T extends string | number | boolean> = Expression<T>;
const DECIMAL_RADIX = 10;
const DATASET_LOCATION_OPTIONS = [
  "us-central1",
  "us-west4",
  "europe-central2",
  "us-west2",
  "northamerica-northeast1",
  "us-east4",
  "us-west1",
  "us-west3",
  "southamerica-east1",
  "us-east1",
  "europe-west1",
  "europe-north1",
  "europe-west3",
  "europe-west2",
  "europe-west4",
  "europe-west6",
  "asia-east1",
  "asia-east2",
  "asia-southeast2",
  "asia-south1",
  "asia-southeast1",
  "asia-northeast2",
  "asia-northeast3",
  "australia-southeast1",
  "asia-northeast1",
  "us",
  "eu",
  "africa-south1",
  "me-west1",
  "me-central1",
  "me-central2",
  "europe-west12",
  "europe-north2",
  "europe-west9",
  "europe-west8",
  "europe-southwest1",
  "europe-west10",
  "australia-southeast2",
  "asia-south2",
  "northamerica-northeast2",
  "southamerica-west1",
  "northamerica-south1",
  "us-south1",
  "us-east5",
] as const;
const DATABASE_REGION_OPTIONS = [
  "eur3",
  "nam5",
  "nam7",
  "us-central1",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "us-east1",
  "us-east4",
  "us-east5",
  "us-south1",
  "northamerica-northeast1",
  "northamerica-northeast2",
  "northamerica-south1",
  "southamerica-east1",
  "southamerica-west1",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "europe-west8",
  "europe-west9",
  "europe-west10",
  "europe-west12",
  "europe-southwest1",
  "europe-north1",
  "europe-north2",
  "europe-central2",
  "me-central1",
  "me-central2",
  "me-west1",
  "asia-south1",
  "asia-south2",
  "asia-southeast1",
  "asia-southeast2",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "australia-southeast1",
  "australia-southeast2",
  "africa-south1",
] as const;
const TABLE_PARTITIONING_OPTIONS = [
  "HOUR",
  "DAY",
  "MONTH",
  "YEAR",
  "NONE",
] as const;
const TIME_PARTITIONING_FIELD_TYPE_OPTIONS = [
  "TIMESTAMP",
  "DATETIME",
  "DATE",
  "omit",
] as const;
const VIEW_TYPE_OPTIONS = [
  "view",
  "materialized_incremental",
  "materialized_non_incremental",
] as const;
const LOG_LEVEL_OPTIONS = ["debug", "info", "warn", "error", "silent"] as const;
export interface ConfigExpressions {
  collectionPath: ConfigExpression<string>;
  datasetId: ConfigExpression<string>;
  tableId: ConfigExpression<string>;
  location: ConfigExpression<string>;
  database: ConfigExpression<string>;
}

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  bigqueryProjectId: defineString("BIGQUERY_PROJECT_ID", {
    default: projectID,
  }),
  database: defineString("DATABASE", { default: "(default)" }),
  databaseRegion: defineString("DATABASE_REGION", {
    input: select([...DATABASE_REGION_OPTIONS]),
  }),
  collectionPath: defineString("COLLECTION_PATH", {
    default: "posts",
    input: {
      text: {
        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage:
          'Firestore collection paths must be an odd number of segments separated by slashes, e.g. "path/to/collection".',
      },
    },
  }),
  datasetId: defineString("DATASET_ID", {
    default: "firestore_export",
    input: {
      text: {
        validationRegex: /^[a-zA-Z0-9_]+$/,
        validationErrorMessage:
          "BigQuery dataset IDs must be alphanumeric (plus underscores) and must be no more than 1024 characters.",
      },
    },
  }),
  tableId: defineString("TABLE_ID", {
    default: "posts",
    input: {
      text: {
        validationRegex: /^[a-zA-Z0-9_]+$/,
        validationErrorMessage:
          "BigQuery table IDs must be alphanumeric (plus underscores) and must be no more than 1024 characters.",
      },
    },
  }),
  datasetLocation: defineString("DATASET_LOCATION", {
    default: "us",
    input: select([...DATASET_LOCATION_OPTIONS]),
  }),
  backupCollection: defineString("BACKUP_COLLECTION", { default: "" }),
  transformFunction: defineString("TRANSFORM_FUNCTION", { default: "" }),
  tablePartitioning: defineString("TABLE_PARTITIONING", {
    default: "NONE",
    input: select([...TABLE_PARTITIONING_OPTIONS]),
  }),
  timePartitioningField: defineString("TIME_PARTITIONING_FIELD", {
    default: "",
  }),
  timePartitioningFieldType: defineString("TIME_PARTITIONING_FIELD_TYPE", {
    default: "omit",
    input: select([...TIME_PARTITIONING_FIELD_TYPE_OPTIONS]),
  }),
  timePartitioningFirestoreField: defineString(
    "TIME_PARTITIONING_FIRESTORE_FIELD",
    { default: "" }
  ),
  clustering: defineString("CLUSTERING", {
    default: "",
    input: {
      text: {
        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[^,\s]+(?:,[^,\s]+){0,3}|)$/,
        validationErrorMessage:
          "No whitespaces. Max 4 fields. e.g. `data,timestamp,event_id,operation`",
      },
    },
  }),
  wildcardIds: defineBoolean("WILDCARD_IDS", {
    default: false,
  }),
  useNewSnapshotQuerySyntax: defineBoolean("USE_NEW_SNAPSHOT_QUERY_SYNTAX", {
    default: false,
  }),
  excludeOldData: defineBoolean("EXCLUDE_OLD_DATA", {
    default: false,
  }),
  viewType: defineString("VIEW_TYPE", {
    default: "view",
    input: select([...VIEW_TYPE_OPTIONS]),
  }),
  maxStaleness: defineString("MAX_STALENESS", { default: "" }),
  refreshIntervalMinutes: defineString("REFRESH_INTERVAL_MINUTES", {
    default: "",
    input: {
      text: {
        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[1-9][0-9]*|)$/,
        validationErrorMessage: "Must be a positive integer",
      },
    },
  }),
  kmsKeyName: defineString("KMS_KEY_NAME", {
    default: "",
    input: {
      text: {
        // Extension regex (unanchored, as upstream), with an empty branch
        // added: the param is optional.
        validationRegex:
          /projects\/([^\/]+)\/locations\/([^\/]+)\/keyRings\/([^\/]+)\/cryptoKeys\/([^\/]+)|^$/,
        validationErrorMessage:
          "The key name must be of the format 'projects/PROJECT_NAME/locations/KEY_RING_LOCATION/keyRings/KEY_RING_ID/cryptoKeys/KEY_ID'.",
      },
    },
  }),
  logLevel: defineString("LOG_LEVEL", {
    default: "info",
    input: select([...LOG_LEVEL_OPTIONS]),
  }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  collectionPath: params.collectionPath,
  datasetId: params.datasetId,
  tableId: params.tableId,
  location: params.databaseRegion,
  database: params.database,
};

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

function normalizePositiveInt(value: string): number | undefined {
  const normalized = Number.parseInt(value, DECIMAL_RADIX);
  return normalized > 0 ? normalized : undefined;
}

/** Coerce an empty-string param value to `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

/**
 * Resolves all deploy-time params into an {@link ExportConfig}.
 *
 * Param values are read when this is called. During the Firebase deploy-time
 * discovery pass params return their declared defaults, so the default
 * `TABLE_PARTITIONING=NONE` keeps {@link buildPartitioningConfig} from throwing.
 * This is the bridge for the env-driven path: env params in, typed config out,
 * which the main entry point wires into the exported functions.
 *
 * @returns The export configuration assembled from environment params.
 */
export function configFromEnv(): ExportConfig {
  const tablePartitioning = optional(params.tablePartitioning.value());

  return {
    collectionPath: params.collectionPath.value(),
    datasetId: params.datasetId.value(),
    tableId: params.tableId.value(),
    location: params.databaseRegion.value(),
    datasetLocation: optional(params.datasetLocation.value()),
    bqProjectId: optional(params.bigqueryProjectId.value()),
    projectId: projectID.value(),
    databaseId: optional(params.database.value()) || "(default)",
    wildcardIds: params.wildcardIds.value(),
    excludeOldData: params.excludeOldData.value(),
    useNewSnapshotQuerySyntax: params.useNewSnapshotQuerySyntax.value(),
    viewType: (optional(params.viewType.value()) || "view") as ViewType,
    partitioning: buildPartitioningConfig({
      timePartitioning: timePartitioning(tablePartitioning),
      timePartitioningField: params.timePartitioningField.value(),
      timePartitioningFieldType: params.timePartitioningFieldType.value(),
      timePartitioningFirestoreField:
        params.timePartitioningFirestoreField.value(),
    }),
    clustering: clustering(optional(params.clustering.value())),
    maxStaleness: optional(params.maxStaleness.value()),
    refreshIntervalMinutes: normalizePositiveInt(
      params.refreshIntervalMinutes.value()
    ),
    backupCollectionId: optional(params.backupCollection.value()),
    transformFunction: optional(params.transformFunction.value()),
    kmsKeyName: optional(params.kmsKeyName.value()),
    logLevel: normalizeLogLevel(params.logLevel.value()),
  };
}

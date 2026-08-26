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
    label: "BigQuery Project ID",
    description:
      "Override the default project for BigQuery instance. This can allow updates to be directed to to a BigQuery instance on another GCP project.",

    default: projectID,
  }),
  database: defineString("DATABASE", {
    label: "Firestore Instance ID",
    description:
      'The Firestore database to use. Use "(default)" for the default database. You can view your available Firestore databases at https://console.cloud.google.com/firestore/databases.',
    default: "(default)",
    input: { text: { example: "(default)" } },
  }),
  databaseRegion: defineString("DATABASE_REGION", {
    label: "Firestore Instance Location",
    description:
      "Where is the Firestore database located? You can check your current database location at https://console.cloud.google.com/firestore/databases.",

    input: select([...DATABASE_REGION_OPTIONS]),
  }),
  collectionPath: defineString("COLLECTION_PATH", {
    label: "Collection path",
    description:
      "What is the path of the collection that you would like to export? You may use `{wildcard}` notation to match a subcollection of all documents in a collection (for example: `chatrooms/{chatid}/posts`). Parent Firestore Document IDs from `{wildcards}` can be returned in `path_params` as a JSON formatted string.",

    default: "posts",
    input: {
      text: {
        example: "posts",

        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage:
          'Firestore collection paths must be an odd number of segments separated by slashes, e.g. "path/to/collection".',
      },
    },
  }),
  datasetId: defineString("DATASET_ID", {
    label: "Dataset ID",
    description:
      "What ID would you like to use for your BigQuery dataset? This extension will create the dataset, if it doesn't already exist.",

    default: "firestore_export",
    input: {
      text: {
        example: "firestore_export",

        validationRegex: /^[a-zA-Z0-9_]+$/,
        validationErrorMessage:
          "BigQuery dataset IDs must be alphanumeric (plus underscores) and must be no more than 1024 characters.",
      },
    },
  }),
  tableId: defineString("TABLE_ID", {
    label: "Table ID",
    description:
      "What identifying prefix would you like to use for your table and view inside your BigQuery dataset? This extension will create the table and view, if they don't already exist.",

    default: "posts",
    input: {
      text: {
        example: "posts",

        validationRegex: /^[a-zA-Z0-9_]+$/,
        validationErrorMessage:
          "BigQuery table IDs must be alphanumeric (plus underscores) and must be no more than 1024 characters.",
      },
    },
  }),
  datasetLocation: defineString("DATASET_LOCATION", {
    label: "BigQuery Dataset location",
    description:
      "Where do you want to deploy the BigQuery dataset created for this extension? For help selecting a location, refer to the [location selection guide](https://cloud.google.com/bigquery/docs/locations).",

    default: "us",
    input: select([...DATASET_LOCATION_OPTIONS]),
  }),
  backupCollection: defineString("BACKUP_COLLECTION", {
    label: "Backup Collection Name",
    description:
      "This (optional) parameter will allow you to specify a collection for which failed BigQuery updates will be written to.",
    default: "",
  }),
  transformFunction: defineString("TRANSFORM_FUNCTION", {
    label: "Transform function URL",
    description:
      "Specify a function URL to call that will transform the payload that will be written to BigQuery. See the pre-install documentation for more details.",
    default: "",
    input: {
      text: {
        example:
          "https://us-west1-my-project-id.cloudfunctions.net/myTransformFunction",
      },
    },
  }),
  tablePartitioning: defineString("TABLE_PARTITIONING", {
    label: "BigQuery SQL table Time Partitioning option type",
    description:
      "This parameter will allow you to partition the BigQuery table and BigQuery view created by the extension based on data ingestion time. You may select the granularity of partitioning based upon one of: HOUR, DAY, MONTH, YEAR. This will generate one partition per day, hour, month or year, respectively.",

    default: "NONE",
    input: select([...TABLE_PARTITIONING_OPTIONS]),
  }),
  timePartitioningField: defineString("TIME_PARTITIONING_FIELD", {
    label: "BigQuery Time Partitioning column name",
    description:
      "BigQuery table column/schema field name for TimePartitioning. You can choose schema available as `timestamp` OR a new custom defined column that will be assigned to the selected Firestore Document field below. Defaults to pseudo column _PARTITIONTIME if unspecified. Cannot be changed if Table is already partitioned.",

    default: "",
  }),
  timePartitioningFieldType: defineString("TIME_PARTITIONING_FIELD_TYPE", {
    label: "BigQuery SQL Time Partitioning table schema field(column) type",
    description:
      "Parameter for BigQuery SQL schema field type for the selected Time Partitioning Firestore Document field option. Cannot be changed if Table is already partitioned.",

    default: "omit",
    input: select([...TIME_PARTITIONING_FIELD_TYPE_OPTIONS]),
  }),
  timePartitioningFirestoreField: defineString(
    "TIME_PARTITIONING_FIRESTORE_FIELD",
    {
      label:
        "Firestore Document field name for BigQuery SQL Time Partitioning field option",
      description:
        "This parameter will allow you to partition the BigQuery table created by the extension based on selected. The Firestore Document field value must be a top-level TIMESTAMP, DATETIME, DATE field BigQuery string format or Firestore timestamp(will be converted to BigQuery TIMESTAMP). Cannot be changed if Table is already partitioned.\n example: `postDate`(Ensure that the Firestore-BigQuery export extension\ncreates the dataset and table before initiating any backfill scripts.\n This step is crucial for the partitioning to function correctly. It is\nessential for the script to insert data into an already partitioned table.)",
      default: "",
    }
  ),
  clustering: defineString("CLUSTERING", {
    label: "BigQuery SQL table clustering",
    description:
      "This parameter allows you to set up clustering for the BigQuery table created by the extension. Specify up to 4 comma-separated fields (for example:  `data,document_id,timestamp` - no whitespaces). The order of the specified  columns determines the sort order of the data. \nNote: Cluster columns must be top-level, non-repeated columns of one of the  following types: BIGNUMERIC, BOOL, DATE, DATETIME, GEOGRAPHY, INT64, NUMERIC,  RANGE, STRING, TIMESTAMP. Clustering will not be added if a field with an invalid type is present in this parameter.\nAvailable schema extensions table fields for clustering include: `document_id, document_name, timestamp, event_id,  operation, data`.",

    default: "",
    input: {
      text: {
        example: "data,document_id,timestamp",

        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[^,\s]+(?:,[^,\s]+){0,3}|)$/,
        validationErrorMessage:
          "No whitespaces. Max 4 fields. e.g. `data,timestamp,event_id,operation`",
      },
    },
  }),
  wildcardIds: defineBoolean("WILDCARD_IDS", {
    label: "Enable Wildcard Column field with Parent Firestore Document IDs",
    description:
      "If enabled, creates a column containing a JSON object of all wildcard ids from a documents path.",

    default: false,
  }),
  useNewSnapshotQuerySyntax: defineBoolean("USE_NEW_SNAPSHOT_QUERY_SYNTAX", {
    label: "Use new query syntax for snapshots",
    description:
      "If enabled, snapshots will be generated with the new query syntax, which should be more performant, and avoid potential resource limitations.",

    default: false,
  }),
  excludeOldData: defineBoolean("EXCLUDE_OLD_DATA", {
    label: "Exclude old data payloads",
    description:
      "If enabled, table rows will never contain old data (document snapshot before the Firestore onDocumentUpdate event: `change.before.data()`). The reduction in data should be more performant, and avoid potential resource limitations.",

    default: false,
  }),
  viewType: defineString("VIEW_TYPE", {
    label: "View Type",
    description:
      "Select the type of view to create in BigQuery. A regular view is a virtual table defined by a SQL query.  A materialized view persists the results of a query for faster access, with either incremental or  non-incremental updates. Please note that materialized views in this extension come with several  important caveats and limitations - carefully review the pre-install documentation before selecting  these options to ensure they are appropriate for your use case.",

    default: "view",
    input: select([...VIEW_TYPE_OPTIONS]),
  }),
  maxStaleness: defineString("MAX_STALENESS", {
    label: "Maximum Staleness Duration",
    description:
      "For materialized views only: Specifies the maximum staleness acceptable for the materialized view.  Should be specified as an INTERVAL value following BigQuery SQL syntax.  This parameter will only take effect if View Type is set to a materialized view option.",
    default: "",
    input: { text: { example: 'INTERVAL "8:0:0" HOUR TO SECOND' } },
  }),
  refreshIntervalMinutes: defineString("REFRESH_INTERVAL_MINUTES", {
    label: "Refresh Interval (Minutes)",
    description:
      "For materialized views only: Specifies how often the materialized view should be refreshed, in minutes.  This parameter will only take effect if View Type is set to a materialized view option.",

    default: "",
    input: {
      text: {
        example: "60",

        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[1-9][0-9]*|)$/,
        validationErrorMessage: "Must be a positive integer",
      },
    },
  }),
  kmsKeyName: defineString("KMS_KEY_NAME", {
    label: "Cloud KMS key name",
    description:
      "Instead of Google managing the key encryption keys that protect your data, you control and manage key encryption keys in Cloud KMS. If this parameter is set, the extension will specify the KMS key name when creating the BQ table. See the PREINSTALL.md for more details.",

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
    label: "Log level",
    description:
      "The log level for the extension. The log level controls the verbosity of the extension's logs. The available log levels are: debug, info, warn, and error. To reduce the volume of logs, use a log level of warn or error.",

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

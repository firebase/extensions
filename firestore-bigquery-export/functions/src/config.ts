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

function timePartitioning(type) {
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

export default {
  bqProjectId: process.env.BIGQUERY_PROJECT_ID,
  databaseId: "(default)",
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
};

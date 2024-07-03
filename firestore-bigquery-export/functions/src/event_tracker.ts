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

import config from "./config";

import {
  FirestoreBigQueryEventHistoryTracker,
  FirestoreEventHistoryTracker,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

export const eventTracker: FirestoreEventHistoryTracker =
  new FirestoreBigQueryEventHistoryTracker({
    tableId: config.tableId,
    datasetId: config.datasetId,
    datasetLocation: config.datasetLocation,
    backupTableId: config.backupCollectionId,
    transformFunction: config.transformFunction,
    timePartitioning: config.timePartitioning,
    timePartitioningField: config.timePartitioningField,
    timePartitioningFieldType: config.timePartitioningFieldType,
    timePartitioningFirestoreField: config.timePartitioningFirestoreField,
    databaseId: config.databaseId,
    clustering: config.clustering,
    wildcardIds: config.wildcardIds,
    bqProjectId: config.bqProjectId,
    useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
    skipInit: true,
    kmsKeyName: config.kmsKeyName,
  });

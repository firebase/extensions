/**
 * Copyright 2026 Google LLC
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

import { firestore } from "firebase-admin";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "../..";
import { LogLevel } from "../../logger";
import { ChangeTrackerConfig } from "../../bigquery/types";

export const changeTracker = ({
  datasetId = "",
  tableId = "",
  datasetLocation = "us",
  wildcardIds = null,
  partitioning = {
    granularity: "NONE",
  },
  transformFunction = "",
  clustering = [],
  bqProjectId = "dev-extensions-testing",
  useNewSnapshotQuerySyntax = false,
  useMaterializedView = false,
  useIncrementalMaterializedView = false,
  maxStaleness = undefined,
  refreshIntervalMinutes = undefined,
  logLevel = LogLevel.DEBUG,
}: Partial<ChangeTrackerConfig>): FirestoreBigQueryEventHistoryTracker => {
  return new FirestoreBigQueryEventHistoryTracker({
    datasetId,
    tableId,
    datasetLocation,
    wildcardIds,
    partitioning,
    transformFunction,
    clustering,
    bqProjectId,
    useNewSnapshotQuerySyntax,
    useMaterializedView,
    useIncrementalMaterializedView,
    maxStaleness,
    refreshIntervalMinutes,
    logLevel,
  });
};

export const changeTrackerEvent = ({
  timestamp = "2022-02-13T10:17:43.505Z",
  operation = ChangeType.CREATE,
  documentName = "testing",
  eventId = "testing",
  documentId = "testing",
  pathParams = { documentId: "12345" },
  data = { end_date: firestore.Timestamp.now() },
  oldData = null,
  useNewSnapshotQuerySyntax = false,
}: any): FirestoreDocumentChangeEvent => {
  return {
    timestamp,
    operation,
    documentName,
    eventId,
    documentId,
    data,
    oldData,
    pathParams,
    useNewSnapshotQuerySyntax,
  };
};

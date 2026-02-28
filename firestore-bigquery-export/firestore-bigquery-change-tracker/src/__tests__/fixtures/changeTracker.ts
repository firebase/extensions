import { firestore } from "firebase-admin";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "../..";
import { LogLevel } from "../../logger";
import { Config } from "../../bigquery/types";

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
}: Partial<Config>): FirestoreBigQueryEventHistoryTracker => {
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

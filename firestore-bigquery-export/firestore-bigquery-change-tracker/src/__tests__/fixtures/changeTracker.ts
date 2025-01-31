import { firestore } from "firebase-admin";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "../..";

export const changeTracker = ({
  datasetId = "",
  tableId = "",
  datasetLocation = null,
  wildcardIds = null,
  timePartitioning = null,
  timePartitioningField = null,
  timePartitioningFieldType = null,
  timePartitioningFirestoreField = null,
  transformFunction = null,
  clustering = null,
  bqProjectId = "dev-extensions-testing",
  useNewSnapshotQuerySyntax = false,
  useMaterializedView = false,
  useIncrementalMaterializedView = false,
  maxStaleness = undefined,
  refreshIntervalMinutes = undefined,
}): FirestoreBigQueryEventHistoryTracker => {
  return new FirestoreBigQueryEventHistoryTracker({
    datasetId,
    tableId,
    datasetLocation,
    wildcardIds,
    timePartitioning,
    timePartitioningField,
    timePartitioningFieldType,
    timePartitioningFirestoreField,
    transformFunction,
    clustering,
    bqProjectId,
    useNewSnapshotQuerySyntax,
    useMaterializedView,
    useIncrementalMaterializedView,
    maxStaleness,
    refreshIntervalMinutes,
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

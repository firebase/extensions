export enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
  IMPORT,
}

export interface FirestoreDocumentChangeEvent {
  // The timestamp represented in ISO format.
  // Date is not appropriate because it only has millisecond precision.
  // Cloud Firestore timestamps have microsecond precision.
  timestamp: string;
  operation: ChangeType;
  documentName: string;
  eventId: string;
  documentId: string;
  pathParams?: { documentId: string; [key: string]: string } | null;
  data: Object;
  oldData?: Object | null;
  useNewSnapshotQuerySyntax?: boolean | null;
}

export interface FirestoreBigQueryEventHistoryTrackerConfig {
  datasetId: string;
  tableId: string;
  datasetLocation?: string | undefined;
  transformFunction?: string | undefined;
  timePartitioning?: string | undefined;
  timePartitioningField?: string | undefined;
  timePartitioningFieldType?: string | undefined;
  timePartitioningFirestoreField?: string | undefined;
  clustering: string[] | null;
  wildcardIds?: boolean;
  bqProjectId?: string | undefined;
  backupTableId?: string | undefined;
  useNewSnapshotQuerySyntax?: boolean;
  skipInit?: boolean;
  kmsKeyName?: string | undefined;
}

import * as admin from "firebase-admin";

export interface CliConfig {
  kind: "CONFIG";
  projectId: string;
  bigQueryProjectId: string;
  sourceCollectionPath: string;
  datasetId: string;
  tableId: string;
  batchSize: number;
  queryCollectionGroup: boolean;
  datasetLocation: string;
  multiThreaded: boolean;
  useNewSnapshotQuerySyntax: boolean;
  useEmulator: boolean;
  rawChangeLogName: string;
  cursorPositionFile: string;
}

export interface CliConfigError {
  kind: "ERROR";
  errors: string[];
}

export interface SerializableQuery {
  startAt: admin.firestore.Query<admin.firestore.DocumentData>;
  endAt: admin.firestore.Query<admin.firestore.DocumentData>;
  limit: admin.firestore.Query<admin.firestore.DocumentData>;
  offset: admin.firestore.Query<admin.firestore.DocumentData>;
}

export interface QueryOptions
  extends admin.firestore.Query<admin.firestore.DocumentSnapshot<any>> {
  _queryOptions: SerializableQuery;
}

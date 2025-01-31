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
  failedBatchOutput?: string;
  transformFunctionUrl?: string;
}

export interface CliConfigError {
  kind: "ERROR";
  errors: string[];
}

export interface SerializableQuery {
  startAt?: {
    before: boolean;
    values: Array<{
      referenceValue: string;
      valueType: string;
    }>;
  };
  endAt?: {
    before: boolean;
    values: Array<{
      referenceValue: string;
      valueType: string;
    }>;
  };
  limit?: number;
  offset?: number;
}

export interface QueryOptions
  extends admin.firestore.Query<admin.firestore.DocumentSnapshot<any>> {
  _queryOptions: SerializableQuery;
}

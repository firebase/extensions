export interface CliConfig {
  kind: "CONFIG";
  projectId: string;
  sourceCollectionPath: string;
  datasetId: string;
  tableId: string;
  batchSize: number;
  queryCollectionGroup: boolean;
  datasetLocation: string;
  multiThreaded: boolean;
}

export interface CliConfigError {
  kind: "ERROR";
  errors: string[];
}

export interface SerializableQuery {
  startAt: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  endAt: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  limit: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  offset: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
}

export interface QueryOptions
  extends FirebaseFirestore.Query<FirebaseFirestore.DocumentSnapshot<any>> {
  _queryOptions: SerializableQuery;
}

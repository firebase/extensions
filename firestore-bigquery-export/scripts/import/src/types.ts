export interface CliConfig {
  projectId: string;
  sourceCollectionPath: string;
  datasetId: string;
  tableId: string;
  batchSize: number;
  queryCollectionGroup: boolean;
  datasetLocation: string;
  multiThreaded: boolean;
}

export interface SerializableQuery {
  startAt: any;
  endAt: any;
  limit: any;
  offset: any;
}

import * as admin from 'firebase-admin';
import {Prefilter} from '../queries/util';

export class VectorStoreClient {
  firestore: admin.firestore.Firestore;
  constructor(firestore: admin.firestore.Firestore) {
    this.firestore = firestore;
  }
  async query(
    _query: number[],
    _collection: string,
    _prefilters: Prefilter[],
    _limit: number,
    _outputField: string
  ): Promise<{ids: string[]}> {
    throw new Error('Not implemented');
  }

  // TODO: not sure if the native API will need this or not?
  async createIndex(_collectionName: string): Promise<any> {
    // throw new Error("Not implemented");
  }

  async upsert(
    _datapoints: {embedding: number[]; id: string}[]
  ): Promise<void> {}
}

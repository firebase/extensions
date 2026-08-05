import {config, VectorStoreProvider} from '../config';
import * as admin from 'firebase-admin';
import {FirestoreVectorStoreClient} from './firestore';

export const getVectorStoreClient = ({
  firestore,
  distanceMeasure,
}: {
  firestore: admin.firestore.Firestore;
  distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
}) => {
  switch (config.vectorStoreProvider) {
    case 'firestore' as VectorStoreProvider:
      return new FirestoreVectorStoreClient(firestore, distanceMeasure);
    default:
      throw new Error('Provider option not implemented');
  }
};

export const textVectorStoreClient = getVectorStoreClient({
  firestore: admin.firestore(),
  distanceMeasure: config.distanceMeasure,
});

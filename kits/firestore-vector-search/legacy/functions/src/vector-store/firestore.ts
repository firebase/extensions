import {Query, VectorQuery} from '@google-cloud/firestore';
import * as admin from 'firebase-admin';
import {Prefilter} from '../queries/util';
import {VectorStoreClient} from './base_class';
import {FirebaseFirestoreError} from 'firebase-admin/firestore';
import {https} from 'firebase-functions/v1';

export class FirestoreVectorStoreClient extends VectorStoreClient {
  firestore: admin.firestore.Firestore;
  distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
  constructor(
    firestore: admin.firestore.Firestore,
    distanceMeasure: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT' = 'COSINE'
  ) {
    super(firestore);
    this.firestore = firestore;
    this.distanceMeasure = distanceMeasure;
  }

  // Converts thrown Firestore or general errors into structured HttpsError objects
  private toHttpsError(error: any, context?: string): https.HttpsError {
    if (error instanceof https.HttpsError) {
      return error;
    }

    if (error instanceof FirebaseFirestoreError) {
      const message = context || error.message;

      // the code will be of the form firestore/code
      const codeWithPrefix = error.code;

      const [prefix, code] = codeWithPrefix.split('/'); // just code

      // check if the prefix is firestore anyway
      if (prefix !== 'firestore') {
        return new https.HttpsError('unknown', message);
      }

      const ALLOWED_ERROR_CODES = new Set<https.FunctionsErrorCode>([
        'cancelled',
        'unknown',
        'invalid-argument',
        'deadline-exceeded',
        'not-found',
        'already-exists',
        'permission-denied',
        'resource-exhausted',
        'aborted',
        'out-of-range',
        'unimplemented',
        'internal',
        'unavailable',
        'data-loss',
        'unauthenticated',
      ]);

      if (ALLOWED_ERROR_CODES.has(code as https.FunctionsErrorCode)) {
        return new https.HttpsError(code as https.FunctionsErrorCode, message);
      }
      return new https.HttpsError('unknown', message, {
        firestoreCode: error.code,
      });
    }

    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('opstr')) {
        return new https.HttpsError(
          'invalid-argument',
          context
            ? `Invalid operator in query: ${context}`
            : 'Invalid operator in Firestore query'
        );
      }

      return new https.HttpsError('unknown', error.message);
    }

    return new https.HttpsError(
      'unknown',
      'An unexpected error occurred performing your query'
    );
  }

  async query(
    query: number[],
    collection: string,
    prefilters: Prefilter[],
    limit: number,
    outputField: string
  ): Promise<{ids: string[]}> {
    try {
      const collectionRef = this.firestore.collection(collection);
      let q: Query | VectorQuery = collectionRef;

      if (prefilters.length > 0) {
        for (const p of prefilters) {
          try {
            q = q.where(p.field, p.operator, p.value);
          } catch (filterError) {
            throw this.toHttpsError(
              filterError,
              `${p.operator} for ${p.field}`
            );
          }
        }
      }

      try {
        q = q.findNearest(outputField, query, {
          limit,
          distanceMeasure: this.distanceMeasure,
        });
      } catch (findNearestError) {
        throw this.toHttpsError(findNearestError);
      }

      const result = await q.get();
      return {ids: result.docs.map(doc => doc.ref.id)};
    } catch (error) {
      throw this.toHttpsError(error);
    }
  }
}

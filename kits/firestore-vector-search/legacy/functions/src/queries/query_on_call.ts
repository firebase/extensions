import {config} from '../config';
import * as functions from 'firebase-functions/v1';
import {embeddingClient} from '../embeddings/client';
import {textVectorStoreClient} from '../vector-store';
import {parseQuerySchema, parseLimit, Prefilter, parsedRequest} from './util';
import {z} from 'zod';

export async function handleQueryCall(data: unknown, context: any) {
  if (!context.auth) {
    // Throwing an error if the user is not authenticated.
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  let queryParams: parsedRequest;
  try {
    queryParams = parseQuerySchema(data);
  } catch (e) {
    const zodError = e instanceof z.ZodError ? e : undefined;
    const errorMessage = 'The function was called with an invalid argument';

    if (zodError) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        errorMessage,
        zodError.errors
      );
    }
    throw new functions.https.HttpsError('invalid-argument', errorMessage);
  }

  const text = queryParams.query;
  const limitParam = queryParams.limit;
  const prefilters: Prefilter[] = queryParams.prefilters || [];

  let limit: number;
  try {
    limit = limitParam ? parseLimit(limitParam) : config.defaultQueryLimit;
  } catch (e) {
    throw new functions.https.HttpsError('invalid-argument', e.message);
  }

  await embeddingClient.initialize();
  const textQueryEmbedding = await embeddingClient.getSingleEmbedding(text);

  return await textVectorStoreClient.query(
    textQueryEmbedding,
    config.collectionName,
    prefilters,
    limit,
    config.outputField
  );
}

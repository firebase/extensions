import * as admin from 'firebase-admin/app';
import * as Firestore from '@google-cloud/firestore';

admin.initializeApp();

export const enum EmbeddingProvider {
  Gemini = 'gemini',
  Multimodal = 'multimodal',
  OpenAI = 'openai',
  VertexAI = 'vertex',
  Custom = 'custom',
}

const embeddingProvider: EmbeddingProvider = process.env
  .EMBEDDING_PROVIDER as EmbeddingProvider;

export const enum VectorStoreProvider {
  Firestore = 'firestore',
}

const LOCATION = process.env.LOCATION;

const defaultBucketName = `${process.env.PROJECT_ID}.appspot.com`;

export const firestoreAdminClient = new Firestore.v1.FirestoreAdminClient();

const getDimension = () => {
  switch (embeddingProvider) {
    case EmbeddingProvider.Gemini:
      return 768;
    case EmbeddingProvider.Multimodal:
      return 512;
    case EmbeddingProvider.OpenAI:
      return 512;
    case EmbeddingProvider.VertexAI:
      return 768;
    case EmbeddingProvider.Custom:
      if (!process.env.CUSTOM_EMBEDDINGS_DIMENSION) {
        throw new Error(
          'Custom embeddings require CUSTOM_EMBEDDINGS_DIMENSION to be set'
        );
      }
      return parseInt(process.env.CUSTOM_EMBEDDINGS_DIMENSION);
  }
};

type DistanceMeasure = 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';

export const config = {
  inputField: process.env.INPUT_FIELD_NAME!,
  outputField: process.env.OUTPUT_FIELD_NAME!,
  statusField: process.env.STATUS_FIELD_NAME!,
  collectionName: process.env.COLLECTION_NAME || 'embeddings',
  backfillQueueName: `locations/${LOCATION}/functions/backfillTask`,
  updateQueueName: `locations/${LOCATION}/functions/updateTask`,
  instanceId: process.env.EXT_INSTANCE_ID!,
  projectId: process.env.PROJECT_ID!,
  location: process.env.LOCATION!,
  doBackfill: process.env.DO_BACKFILL === 'true',
  customEmbeddingConfig: {
    batchSize: process.env.CUSTOM_EMBEDDINGS_BATCH_SIZE
      ? parseInt(process.env.CUSTOM_EMBEDDINGS_BATCH_SIZE)
      : undefined,
    endpoint: process.env.CUSTOM_EMBEDDINGS_ENDPOINT,
    dimension: process.env.CUSTOM_EMBEDDINGS_DIMENSION
      ? parseInt(process.env.CUSTOM_EMBEDDINGS_DIMENSION)
      : undefined,
  },
  embeddingProvider: embeddingProvider,
  multimodal: embeddingProvider === EmbeddingProvider.Multimodal,
  vectorStoreProvider: 'firestore',
  geminiApiKey: process.env.GEMINI_API_KEY,
  openAIApiKey: process.env.OPENAI_API_KEY,
  bucketName: process.env.BUCKET_NAME || defaultBucketName,
  indexMetadataDocumentPath: `_${process.env.EXT_INSTANCE_ID}/index`,
  queryCollectionName: `_${process.env.EXT_INSTANCE_ID}/index/queries`,
  defaultQueryLimit: parseInt(process.env.DEFAULT_QUERY_LIMIT!),
  dimension: getDimension(),
  distanceMeasure: process.env.DISTANCE_MEASURE as DistanceMeasure,
};

export const obfuscatedConfig = {
  ...config,
  geminiApiKey: '<omitted>',
  openAIApiKey: '<omitted>',
};

export {admin};

// Mock firebase-functions
jest.mock('firebase-functions/v1', () => ({
  ...jest.requireActual('firebase-functions/v1'),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock embeddings client
jest.mock('../src/embeddings/client', () => ({
  embeddingClient: {
    initialize: jest.fn(),
    getSingleEmbedding: jest.fn(),
  },
}));

// Mock vector store client
jest.mock('../src/vector-store', () => ({
  textVectorStoreClient: {
    query: jest.fn(),
  },
}));

// Mock config
jest.mock('../src/config', () => ({
  config: {
    defaultQueryLimit: 10,
    collectionName: 'test-collection',
    outputField: 'content',
    geminiApiKey: 'test-api-key',
    location: 'us-central1',
  },
  firestoreAdminClient: {
    listIndexes: jest.fn(),
    createIndex: jest.fn(),
    getIndex: jest.fn(),
  },
}));

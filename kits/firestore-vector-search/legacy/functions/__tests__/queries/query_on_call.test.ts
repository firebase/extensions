import {handleQueryCall} from '../../src/queries/query_on_call';
import {embeddingClient} from '../../src/embeddings/client';
import {textVectorStoreClient} from '../../src/vector-store';
import {config} from '../../src/config';

describe('handleQueryCall', () => {
  let mockContext: {auth: any};
  const mockEmbedding = [0.1, 0.2, 0.3];
  const mockQueryResults = [
    {id: '1', content: 'result 1'},
    {id: '2', content: 'result 2'},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {auth: {uid: 'test-user'}};

    // Setup default mock implementations
    (embeddingClient.initialize as jest.Mock).mockResolvedValue(undefined);
    (embeddingClient.getSingleEmbedding as jest.Mock).mockResolvedValue(
      mockEmbedding
    );
    (textVectorStoreClient.query as jest.Mock).mockResolvedValue(
      mockQueryResults
    );
  });

  test('should successfully handle a query with default limit', async () => {
    const data = {query: 'test query'};

    const result = await handleQueryCall(data, mockContext);

    expect(embeddingClient.initialize).toHaveBeenCalled();
    expect(embeddingClient.getSingleEmbedding).toHaveBeenCalledWith(
      'test query'
    );
    expect(textVectorStoreClient.query).toHaveBeenCalledWith(
      mockEmbedding,
      config.collectionName,
      [],
      config.defaultQueryLimit,
      config.outputField
    );
    expect(result).toEqual(mockQueryResults);
  });

  test('should handle a query with custom limit', async () => {
    const data = {
      query: 'test query',
      limit: 5,
    };

    const result = await handleQueryCall(data, mockContext);

    expect(textVectorStoreClient.query).toHaveBeenCalledWith(
      mockEmbedding,
      config.collectionName,
      [],
      5,
      config.outputField
    );
    expect(result).toEqual(mockQueryResults);
  });

  test('should handle a query with prefilters', async () => {
    const prefilters = [
      {
        field: 'category',
        operator: '==',
        value: 'test',
      },
    ];
    const data = {
      query: 'test query',
      prefilters,
    };

    const result = await handleQueryCall(data, mockContext);

    expect(textVectorStoreClient.query).toHaveBeenCalledWith(
      mockEmbedding,
      config.collectionName,
      prefilters,
      config.defaultQueryLimit,
      config.outputField
    );
    expect(result).toEqual(mockQueryResults);
  });

  test('should throw unauthenticated error when no auth context', async () => {
    const data = {query: 'test query'};
    mockContext.auth = null;

    await expect(handleQueryCall(data, mockContext)).rejects.toEqual(
      expect.objectContaining({
        code: 'unauthenticated',
        message: 'The function must be called while authenticated.',
      })
    );

    expect(embeddingClient.initialize).not.toHaveBeenCalled();
  });

  test('should throw invalid-argument error for missing query', async () => {
    const data = {limit: 5};

    await expect(handleQueryCall(data, mockContext)).rejects.toEqual(
      expect.objectContaining({
        code: 'invalid-argument',
        message: 'The function was called with an invalid argument',
      })
    );

    expect(embeddingClient.initialize).not.toHaveBeenCalled();
  });

  test('should throw invalid-argument error for invalid limit', async () => {
    const data = {
      query: 'test query',
      limit: -1,
    };

    await expect(handleQueryCall(data, mockContext)).rejects.toEqual(
      expect.objectContaining({
        code: 'invalid-argument',
        message: 'limit must be an integer greater than 0',
        details: undefined,
      })
    );

    expect(embeddingClient.initialize).not.toHaveBeenCalled();
  });

  test('should include ZodError details in invalid-argument error', async () => {
    const data = {}; // Missing required query field

    const result = await handleQueryCall(data, mockContext).catch(e => e);

    expect(result.code).toBe('invalid-argument');
    expect(result.message).toBe(
      'The function was called with an invalid argument'
    );
    expect(result.details).toBeDefined();
    expect(Array.isArray(result.details)).toBe(true);
  });

  test('should handle embedding client initialization failure', async () => {
    const error = new Error('Initialization failed');
    (embeddingClient.initialize as jest.Mock).mockRejectedValue(error);
    const data = {query: 'test query'};

    await expect(handleQueryCall(data, mockContext)).rejects.toThrow(error);
  });

  test('should handle embedding generation failure', async () => {
    const error = new Error('Embedding generation failed');
    (embeddingClient.getSingleEmbedding as jest.Mock).mockRejectedValue(error);
    const data = {query: 'test query'};

    await expect(handleQueryCall(data, mockContext)).rejects.toThrow(error);
  });

  test('should handle vector store query failure', async () => {
    const error = new Error('Query failed');
    (textVectorStoreClient.query as jest.Mock).mockRejectedValue(error);
    const data = {query: 'test query'};

    await expect(handleQueryCall(data, mockContext)).rejects.toThrow(error);
  });
});

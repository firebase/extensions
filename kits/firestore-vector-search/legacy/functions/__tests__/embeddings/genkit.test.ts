jest.resetModules();

// Mocking `@genkit-ai/google-genai`
jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: Object.assign(jest.fn(), {
    embedder: jest.fn(() => 'gemini-embedding-001'),
  }),
  vertexAI: Object.assign(jest.fn(), {
    embedder: jest.fn(() => 'gemini-embedding-001'),
  }),
}));

jest.mock('../../src/config', () => ({
  config: {
    geminiApiKey: 'test-api-key',
    location: 'us-central1',
  },
}));

import {GenkitEmbedClient} from '../../src/embeddings/client/genkit';
import {genkit} from 'genkit';
import {vertexAI, googleAI} from '@genkit-ai/google-genai';

// Mock the genkit client with properly structured responses
const mockEmbedMany = jest.fn();
const mockEmbed = jest.fn();
jest.mock('genkit', () => ({
  genkit: jest.fn().mockImplementation(() => ({
    embedMany: mockEmbedMany,
    embed: mockEmbed,
  })),
}));

describe('GenkitEmbedClient', () => {
  let embedClient: GenkitEmbedClient;
  let mockVertexAI: jest.Mock;
  let mockGoogleAI: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVertexAI = vertexAI as unknown as jest.Mock;
    mockGoogleAI = googleAI as unknown as jest.Mock;
  });

  describe('constructor', () => {
    test('should initialize with Vertex AI provider', () => {
      embedClient = new GenkitEmbedClient({
        provider: 'vertexai',
        batchSize: 100,
        dimension: 768,
      });

      expect(embedClient.provider).toBe('vertexai');
      expect(embedClient.embedder).toBe('gemini-embedding-001');
      expect(mockVertexAI).toHaveBeenCalledWith({
        location: 'us-central1',
      });
      expect(genkit).toHaveBeenCalledWith({
        plugins: [undefined], // because the mock returns undefined
      });
    });

    test('should initialize with Google AI provider', () => {
      embedClient = new GenkitEmbedClient({
        provider: 'googleai',
        batchSize: 100,
        dimension: 768,
      });

      expect(embedClient.provider).toBe('googleai');
      expect(embedClient.embedder).toBe('gemini-embedding-001');
      expect(mockGoogleAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
      expect(genkit).toHaveBeenCalledWith({
        plugins: [undefined], // because the mock returns undefined
      });
    });
  });

  describe('getEmbeddings', () => {
    beforeEach(() => {
      embedClient = new GenkitEmbedClient({
        provider: 'vertexai',
        batchSize: 100,
        dimension: 768,
      });
    });

    test('should return embeddings for a batch of inputs', async () => {
      const mockResults = [{embedding: [1, 2, 3]}, {embedding: [4, 5, 6]}];
      mockEmbedMany.mockResolvedValueOnce(mockResults);

      const inputs = ['input1', 'input2'];
      const embeddings = await embedClient.getEmbeddings(inputs);

      expect(mockEmbedMany).toHaveBeenCalledWith({
        embedder: embedClient.embedder,
        content: inputs,
      });

      expect(embeddings).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    test('should throw an error if embedding fails', async () => {
      mockEmbedMany.mockRejectedValueOnce(new Error('Embedding failed'));

      await expect(embedClient.getEmbeddings(['input'])).rejects.toThrow(
        'Embedding failed'
      );

      expect(mockEmbedMany).toHaveBeenCalledWith({
        embedder: embedClient.embedder,
        content: ['input'],
      });
    });
  });

  describe('getSingleEmbedding', () => {
    beforeEach(() => {
      embedClient = new GenkitEmbedClient({
        provider: 'googleai',
        batchSize: 100,
        dimension: 768,
      });
    });

    test('should return a single embedding for an input', async () => {
      mockEmbed.mockResolvedValueOnce([{embedding: [7, 8, 9]}]); // Changed to return array directly

      const input = 'input1';
      const embedding = await embedClient.getSingleEmbedding(input);

      expect(mockEmbed).toHaveBeenCalledWith({
        embedder: embedClient.embedder,
        content: input,
      });

      expect(embedding).toEqual([7, 8, 9]);
    });

    test('should throw an error if embedding fails', async () => {
      mockEmbed.mockRejectedValueOnce(new Error('Embedding failed'));

      await expect(embedClient.getSingleEmbedding('input')).rejects.toThrow(
        'Embedding failed'
      );

      expect(mockEmbed).toHaveBeenCalledWith({
        embedder: embedClient.embedder,
        content: 'input',
      });
    });
  });
});

import {EmbedderReference, Genkit, genkit} from 'genkit';
import {config} from '../../config';
import {GenkitPluginV2} from 'genkit/plugin';
import {googleAI, vertexAI} from '@genkit-ai/google-genai';

export class GenkitEmbedClient {
  provider: 'vertexai' | 'googleai' | 'multimodal';
  client: Genkit;
  embedder: EmbedderReference;
  batchSize: number;
  dimension: number;

  constructor({
    provider,
  }: {
    batchSize: number;
    dimension: number;
    provider: 'vertexai' | 'googleai';
  }) {
    this.provider = provider;

    let plugins: GenkitPluginV2[] = [];

    if (this.provider === 'vertexai') {
      this.embedder = vertexAI.embedder('gemini-embedding-001', {
        outputDimensionality: 768,
      });
      plugins = [
        vertexAI({
          location: config.location,
        }),
      ];
    }
    if (this.provider === 'googleai') {
      this.embedder = googleAI.embedder('gemini-embedding-001', {
        outputDimensionality: 768,
      });
      plugins = [
        googleAI({
          apiKey: config.geminiApiKey,
        }),
      ];
    }
    this.client = genkit({
      plugins,
    });
  }

  async initialize() {
    // optional to implement this as it might not be needed.
  }

  async getEmbeddings(inputs: string[]): Promise<number[][]> {
    const embeddingResults = await this.client.embedMany({
      embedder: this.embedder,
      content: inputs,
    });
    return embeddingResults.map(result => result.embedding);
  }

  async getSingleEmbedding(input: string): Promise<number[]> {
    const embeddingResults = await this.client.embed({
      embedder: this.embedder,
      content: input,
    });
    return embeddingResults[0].embedding;
  }
}

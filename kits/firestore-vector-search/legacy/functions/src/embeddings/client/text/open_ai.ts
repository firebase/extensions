import OpenAI from 'openai';
import {EmbedClient} from '../base_class';
import {config} from '../../../config';

export class OpenAIEmbedClient extends EmbedClient {
  openaiClient: OpenAI | undefined;

  constructor() {
    // TODO: double check batch size
    super({batchSize: 16, dimension: 1536}); // Adjust the dimension based on the model you choose
  }

  async initialize() {
    await super.initialize();
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: config.openAIApiKey,
      });
      console.log('Initialized OpenAI Client');
    }
  }

  async getEmbeddings(batch: string[]): Promise<number[][]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client is not initialized');
    }

    const embeddingRequest: OpenAI.Embeddings.EmbeddingCreateParams = {
      model: 'text-embedding-ada-002',
      input: batch,
    };

    try {
      const response =
        await this.openaiClient.embeddings.create(embeddingRequest);
      const embeddings = response.data.map(e => e.embedding);

      return embeddings;
    } catch (error) {
      console.error('Error fetching embeddings:', error);
      throw new Error('Error with embedding, see function logs for details');
    }
  }
}

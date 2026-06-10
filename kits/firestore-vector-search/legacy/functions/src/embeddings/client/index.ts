import {config, EmbeddingProvider} from '../../config';
import {MultimodalEmbeddingClient} from './multimodal';
import {CustomEndpointClient} from './text/custom_function';
import {OpenAIEmbedClient} from './text/open_ai';
import {GenkitEmbedClient} from './genkit';
const getEmbeddingClient = () => {
  // Use Genkit where possible.
  switch (config.embeddingProvider) {
    case 'gemini' as EmbeddingProvider.Gemini:
    case 'vertex' as EmbeddingProvider.VertexAI: {
      // Note genkit is yet to support multimodal embeddings
      const provider =
        config.embeddingProvider === 'vertex' ? 'vertexai' : 'googleai';
      return new GenkitEmbedClient({
        batchSize: 1,
        dimension: 768,
        provider,
      });
    }
    case 'multimodal' as EmbeddingProvider.Multimodal:
      return new MultimodalEmbeddingClient({
        batchSize: 1,
        dimension: 1408,
      });
    case 'openai' as EmbeddingProvider.OpenAI:
      return new OpenAIEmbedClient();
    case 'custom' as EmbeddingProvider.Custom:
      return new CustomEndpointClient();
    default:
      throw new Error('Provider option not implemented');
  }
};

export const embeddingClient = getEmbeddingClient();

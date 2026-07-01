import type { ResolvedVectorSearchConfig } from "../export-config";
import type { EmbedClient } from "./client/base_class";
import { GenkitEmbedClient } from "./client/genkit";
import { MultimodalEmbedClient } from "./client/multimodal";
import { CustomEndpointClient } from "./client/text/custom_function";
import { OpenAiEmbedClient } from "./client/text/open_ai";

export type { EmbedClient } from "./client/base_class";

export function createEmbedClient(
  config: ResolvedVectorSearchConfig
): EmbedClient {
  switch (config.embeddingProvider) {
    case "gemini":
    case "vertex":
      return new GenkitEmbedClient(config);
    case "openai":
      return new OpenAiEmbedClient(config);
    case "custom":
      return new CustomEndpointClient(config);
    case "multimodal":
      return new MultimodalEmbedClient(config);
  }
}

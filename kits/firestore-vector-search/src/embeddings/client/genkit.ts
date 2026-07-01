import { googleAI, vertexAI } from "@genkit-ai/google-genai";
import { type EmbedderReference, type Genkit, genkit } from "genkit";
import type { ResolvedVectorSearchConfig } from "../../export-config";
import { BaseEmbedClient } from "./base_class";

export class GenkitEmbedClient extends BaseEmbedClient {
  private readonly client: Genkit;
  private readonly embedder: EmbedderReference;

  constructor(config: ResolvedVectorSearchConfig) {
    super(1);
    const isVertex = config.embeddingProvider === "vertex";
    this.embedder = isVertex
      ? vertexAI.embedder("gemini-embedding-001", {
          outputDimensionality: config.dimension,
        })
      : googleAI.embedder("gemini-embedding-001", {
          outputDimensionality: config.dimension,
        });
    this.client = genkit({
      plugins: [
        isVertex
          ? vertexAI({ location: config.region })
          : googleAI({ apiKey: config.geminiApiKey }),
      ],
    });
  }

  async getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]> {
    const results = await this.client.embedMany({
      embedder: this.embedder,
      content: [...inputs],
    });
    return results.map((result) => result.embedding);
  }
}

import OpenAI from "openai";
import type { ResolvedVectorSearchConfig } from "../../../export-config";
import { BaseEmbedClient } from "../base_class";

export class OpenAiEmbedClient extends BaseEmbedClient {
  private readonly client: OpenAI;

  constructor(config: ResolvedVectorSearchConfig) {
    super(1);
    if (!config.openAiApiKey) {
      throw new Error("OpenAI embeddings require OPENAI_API_KEY");
    }
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]> {
    const results = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: [...inputs],
      dimensions: 512,
    });
    return results.data.map((result) => result.embedding);
  }
}

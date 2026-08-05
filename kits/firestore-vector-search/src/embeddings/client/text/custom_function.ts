import { z } from "zod";
import type { ResolvedVectorSearchConfig } from "../../../export-config";
import { BaseEmbedClient } from "../base_class";

export class CustomEndpointClient extends BaseEmbedClient {
  constructor(private readonly config: ResolvedVectorSearchConfig) {
    super(config.customEmbeddingsBatchSize ?? 1);
    if (
      !config.customEmbeddingsEndpoint ||
      !config.customEmbeddingsBatchSize ||
      !config.customEmbeddingsDimension
    ) {
      throw new Error(
        "Custom embeddings require endpoint, batch size, and dimension"
      );
    }
  }

  async getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]> {
    const endpoint = this.config.customEmbeddingsEndpoint;
    if (!endpoint) {
      throw new Error("Custom embeddings require an endpoint");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ batch: inputs }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Error getting embeddings from custom endpoint: ${response.statusText}`
      );
    }

    const data = await response.json();
    const parsed = z
      .object({ embeddings: z.array(z.array(z.number())) })
      .parse(data);
    if (parsed.embeddings.length !== inputs.length) {
      throw new Error(
        "Error getting embeddings from custom endpoint: response does not contain embeddings for all inputs"
      );
    }
    return parsed.embeddings;
  }
}

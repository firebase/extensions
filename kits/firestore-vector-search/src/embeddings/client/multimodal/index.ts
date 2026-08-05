import type { ResolvedVectorSearchConfig } from "../../../export-config";
import { BaseEmbedClient } from "../base_class";

export class MultimodalEmbedClient extends BaseEmbedClient {
  constructor(_config: ResolvedVectorSearchConfig) {
    super(1);
  }

  async getEmbeddings(_inputs: ReadonlyArray<string>): Promise<number[][]> {
    throw new Error(
      "Multimodal embeddings are not implemented in this package"
    );
  }
}

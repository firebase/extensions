/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(
        "Error getting embeddings from custom endpoint: response is not JSON"
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

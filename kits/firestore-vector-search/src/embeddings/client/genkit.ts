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

import { googleAI, vertexAI } from "@genkit-ai/google-genai";
import { type EmbedderReference, type Genkit, genkit } from "genkit";
import type { ResolvedVectorSearchConfig } from "../../export-config";
import { BaseEmbedClient } from "./base_class";

export class GenkitEmbedClient extends BaseEmbedClient {
  private readonly client: Genkit;
  private readonly embedder: EmbedderReference;
  private readonly dimension: number;

  constructor(config: ResolvedVectorSearchConfig) {
    super(1);
    this.dimension = config.dimension;
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
    return results.map((result) => {
      const embedding = result.embedding;
      if (embedding.length <= this.dimension) {
        return embedding;
      }
      return embedding.slice(0, this.dimension);
    });
  }
}

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

import OpenAI from "openai";
import type { ResolvedVectorSearchConfig } from "../../../export-config";
import { BaseEmbedClient } from "../base_class";

export class OpenAiEmbedClient extends BaseEmbedClient {
  private readonly client: OpenAI;

  constructor(config: ResolvedVectorSearchConfig) {
    super(16);
    if (!config.openAiApiKey) {
      throw new Error("OpenAI embeddings require OPENAI_API_KEY");
    }
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]> {
    const results = await this.client.embeddings.create({
      model: "text-embedding-ada-002",
      input: [...inputs],
    });
    return results.data.map((result) => result.embedding);
  }
}

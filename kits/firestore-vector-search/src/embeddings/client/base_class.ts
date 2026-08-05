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

export interface EmbedClient {
  readonly batchSize: number;
  getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]>;
  getSingleEmbedding(input: string): Promise<number[]>;
}

export abstract class BaseEmbedClient implements EmbedClient {
  constructor(public readonly batchSize: number) {}

  abstract getEmbeddings(inputs: ReadonlyArray<string>): Promise<number[][]>;

  async getSingleEmbedding(input: string): Promise<number[]> {
    const embeddings = await this.getEmbeddings([input]);
    return embeddings[0];
  }
}

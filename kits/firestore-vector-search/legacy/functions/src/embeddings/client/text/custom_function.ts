/**
 * Copyright 2023 Google LLC
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

import {z} from 'zod';
import {config} from '../../../config';
import {EmbedClient} from '../base_class';

const {endpoint, batchSize, dimension} = config.customEmbeddingConfig;

export class CustomEndpointClient extends EmbedClient {
  constructor() {
    if (!endpoint || !batchSize || !dimension) {
      throw new Error(
        'One or more of the custom endpoint parameters are not defined! These parameters are required for this embedding client.'
      );
    }
    super({batchSize, dimension});
  }

  async initialize() {}

  async getEmbeddings(batch: string[]): Promise<number[][]> {
    const res = await fetch(endpoint!, {
      method: 'POST',
      body: JSON.stringify({batch}),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Error getting embeddings from custom endpoint: ${res.statusText}`
      );
    }
    if (!res.headers.get('content-type')?.includes('application/json')) {
      throw new Error(
        'Error getting embeddings from custom endpoint: response is not JSON'
      );
    }
    const data = await res.json();

    const dataSchema = z.object({
      embeddings: z.array(z.array(z.number())),
    });

    let embeddings: number[][] = [];

    try {
      embeddings = dataSchema.parse(data).embeddings;
    } catch (e) {
      throw new Error(
        'Error getting embeddings from custom endpoint: response does not match expected schema'
      );
    }

    if (
      !embeddings ||
      !Array.isArray(embeddings) ||
      embeddings.length !== batch.length
    ) {
      throw new Error(
        'Error getting embeddings from custom endpoint: response does not contain embeddings'
      );
    }
    return embeddings;
  }
}

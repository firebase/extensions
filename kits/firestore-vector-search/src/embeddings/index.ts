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

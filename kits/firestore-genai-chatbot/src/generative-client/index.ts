/*
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

import type { GoogleGenerativeAI } from "@google/generative-ai";
import type { GoogleGenAI } from "@google/genai";
import type { Genkit } from "genkit";
import {
  GenerativeAIProvider,
  type ResolvedGenaiChatbotConfig,
} from "../export-config";
import type { DiscussionClient } from "./base_class";
import { GenkitDiscussionClient } from "./genkit";
import { GeminiDiscussionClient } from "./google_ai";
import { VertexDiscussionClient } from "./vertex_ai";

type Client = Genkit | GoogleGenAI | GoogleGenerativeAI;

/**
 * Selects and constructs the generative client for a request. Prefers the
 * Genkit client when it can serve the request (single candidate), falling back
 * to the provider-specific SDK clients.
 *
 * @param config - The resolved chatbot configuration.
 * @param candidateCount - Effective candidate count for this request, which
 *   per-discussion overrides can raise above the deploy-time value.
 * @returns A ready-to-use discussion client.
 */
export const getGenerativeClient = (
  config: ResolvedGenaiChatbotConfig,
  candidateCount = config.candidateCount
): DiscussionClient<Client, any, any> => {
  if (GenkitDiscussionClient.shouldUseGenkitClient(config, candidateCount)) {
    return new GenkitDiscussionClient(config);
  }

  switch (config.provider as GenerativeAIProvider) {
    case GenerativeAIProvider.GOOGLE_AI:
      if (!config.googleAi.model) throw new Error("Gemini model not set");

      return new GeminiDiscussionClient({
        apiKey: config.googleAi.apiKey,
        modelName: config.googleAi.model,
      });
    case GenerativeAIProvider.VERTEX_AI:
      return new VertexDiscussionClient({
        modelName: config.vertex.model,
        projectId: config.projectId,
        modelLocation: config.vertex.modelLocation,
      });
    default:
      throw new Error("Invalid provider");
  }
};

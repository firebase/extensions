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

import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import {
  type GoogleAIPluginOptions,
  googleAI,
  vertexAI,
} from "@genkit-ai/google-genai";
import type { VertexPluginOptions } from "@genkit-ai/google-genai/lib/vertexai";
import {
  type MessageData as ApiMessage,
  type GenerateOptions,
  type Genkit,
  genkit,
  type ModelReference,
} from "genkit";
import { logger as genkitLogger } from "genkit/logging";
import type { GenkitPluginV2 } from "genkit/plugin";
import type { ResolvedGenaiChatbotConfig } from "../export-config";
import { logger } from "../logger";
import {
  type ChatResponse,
  DiscussionClient,
  type Message,
} from "./base_class";

genkitLogger.setLogLevel("info");

/** Chat client backed by Genkit (the preferred path for single-candidate). */
export class GenkitDiscussionClient extends DiscussionClient<
  Genkit,
  any,
  ApiMessage
> {
  private provider: "google-ai" | "vertex-ai";
  private generateOptions: GenerateOptions;
  private pluginOptions: VertexPluginOptions | GoogleAIPluginOptions;
  private plugin: GenkitPluginV2;

  constructor(config: ResolvedGenaiChatbotConfig) {
    super();
    this.provider = config.provider;
    this.pluginOptions = this.getPluginOptions(config);
    this.plugin = this.initializePlugin();
    this.client = this.initializeGenkit(config);
    this.generateOptions = this.createGenerateOptions(config);
  }

  private getPluginOptions(config: ResolvedGenaiChatbotConfig) {
    if (this.provider === "google-ai") {
      if (!config.googleAi.apiKey) {
        throw new Error("API key required.");
      }
      const pluginConfig: GoogleAIPluginOptions = {
        apiKey: config.googleAi.apiKey,
      };
      return pluginConfig;
    }
    const pluginConfig: VertexPluginOptions = {
      location: config.vertex.modelLocation,
    };
    return pluginConfig;
  }

  private initializePlugin(): GenkitPluginV2 {
    if (this.provider === "google-ai") {
      return googleAI(this.pluginOptions as GoogleAIPluginOptions);
    }
    if (this.provider === "vertex-ai") {
      return vertexAI(this.pluginOptions as VertexPluginOptions);
    }
    throw new Error("Invalid provider.");
  }

  private initializeGenkit(config: ResolvedGenaiChatbotConfig): Genkit {
    const genkitConfig = {
      plugins: [this.plugin],
    };

    if (config.enableGenkitMonitoring) {
      try {
        enableFirebaseTelemetry();
        logger.info("Genkit Monitoring enabled");
      } catch (error) {
        logger.error("Failed to enable Genkit Monitoring", error);
      }
    }

    return genkit(genkitConfig);
  }

  /**
   * Resolves a Genkit model reference via `googleAI.model()` / `vertexAI.model()`.
   * Any id is passed through so current Gemini releases work without a package update.
   */
  static createModelReference(
    model: string,
    provider: string
  ): ModelReference<any> {
    return provider === "google-ai"
      ? googleAI.model(model)
      : vertexAI.model(model);
  }

  private createGenerateOptions(
    config: ResolvedGenaiChatbotConfig
  ): GenerateOptions {
    if (!config.model) {
      throw new Error("Model not found.");
    }

    return {
      model: GenkitDiscussionClient.createModelReference(
        config.model,
        config.provider
      ),
      config: {
        topP: config.topP,
        topK: config.topK,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        safetySettings: config.safetySettings,
      },
    };
  }

  /** Whether the Genkit client can serve this config (single candidate). */
  static shouldUseGenkitClient(config: ResolvedGenaiChatbotConfig): boolean {
    const shouldReturnMultipleCandidates =
      config.candidateCount && config.candidateCount > 1;
    return !shouldReturnMultipleCandidates;
  }

  async generateResponse(
    history: Message[],
    latestApiMessage: any,
    _options: any
  ): Promise<ChatResponse> {
    logger.debug("Generating response with Genkit");

    const messages = this.messagesToApi(history);

    const llmResponse = await this.client.generate({
      messages,
      prompt: latestApiMessage.content[0].text,
      ...this.generateOptions,
    });

    return {
      response: llmResponse.text,
      candidates: [llmResponse.text],
      history,
    };
  }

  createApiMessage(
    messageContent: string,
    role: "user" | "model" = "user"
  ): ApiMessage {
    const apiRole = role === "user" ? "user" : "model";
    return {
      role: apiRole,
      content: [{ text: messageContent }],
    };
  }

  messagesToApi(messages: Message[]): ApiMessage[] {
    const out: ApiMessage[] = [];
    for (const message of messages) {
      if (!message.prompt || !message.response) {
        continue;
      }
      out.push({ role: "user", content: [{ text: message.prompt }] });
      out.push({ role: "model", content: [{ text: message.response }] });
    }
    return out;
  }
}

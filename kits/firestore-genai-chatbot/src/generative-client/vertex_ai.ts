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

import {
  type Content,
  type GenerateContentRequest,
  type Part,
  VertexAI,
  type SafetySetting as VertexSafetySetting,
} from "@google-cloud/vertexai";
import { logger } from "../logger";
import { DiscussionClient, type Message } from "./base_class";

interface GeminiChatOptions {
  history?: Message[];
  model: string;
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  projectId: string;
  location: string;
  context?: string;
  safetySettings?: VertexSafetySetting[];
}

type ApiMessage = {
  role: string;
  parts: Part[];
};

enum Role {
  USER = "user",
  GEMINI = "model",
}

/** Chat client backed by the Vertex AI SDK. */
export class VertexDiscussionClient extends DiscussionClient<
  VertexAI,
  GeminiChatOptions,
  ApiMessage
> {
  modelName: string;

  constructor({
    modelName,
    projectId,
    modelLocation,
  }: {
    modelName: string;
    projectId: string;
    modelLocation?: string;
  }) {
    super();
    this.client = new VertexAI({
      project: projectId,
      location: modelLocation,
    });
    if (!modelName) {
      throw new Error("Model name required.");
    }
    this.modelName = modelName;
  }

  createApiMessage(
    messageContent: string,
    role: "user" | "model" = "user"
  ): ApiMessage {
    const apiRole = role === "user" ? Role.USER : Role.GEMINI;
    return {
      role: apiRole,
      parts: [{ text: messageContent }],
    };
  }

  async generateResponse(
    history: Message[],
    latestApiMessage: ApiMessage,
    options: GeminiChatOptions
  ) {
    if (!this.client) {
      throw new Error("Client not initialized.");
    }

    const generativeModel = this.client.preview.getGenerativeModel({
      model: this.modelName,
    });

    const contents = [...this.messagesToApi(history), latestApiMessage];

    const request: GenerateContentRequest = {
      contents,
      generationConfig: {
        topK: options.topK,
        topP: options.topP,
        temperature: options.temperature,
        candidateCount: options.candidateCount,
        maxOutputTokens: options.maxOutputTokens,
      },
      safetySettings: options.safetySettings,
    };
    const responseStream = await generativeModel
      .generateContentStream(request)
      .catch((e) => {
        logger.error("Failed to generate response", e);
        // The upstream error can expose the API key, so surface a safe message.
        throw new Error(
          "Failed to generate response, see function logs for more details."
        );
      });
    const result = await responseStream.response;

    if (
      !result.candidates ||
      !Array.isArray(result.candidates) ||
      result.candidates.length === 0
    ) {
      throw new Error("No candidates returned");
    }

    const candidates = result.candidates
      .map((candidate) => candidate.content?.parts?.[0]?.text)
      .filter((text): text is string => typeof text === "string");

    if (candidates.length === 0) {
      throw new Error("No text candidates returned");
    }

    return {
      response: candidates[0],
      candidates,
      safetyMetadata: result.promptFeedback,
      history,
    };
  }

  private messagesToApi(messages: Message[]) {
    const out: Content[] = [];
    for (const message of messages) {
      if (!message.prompt || !message.response) {
        continue;
      }
      out.push({ role: Role.USER, parts: [{ text: message.prompt }] });
      out.push({ role: Role.GEMINI, parts: [{ text: message.response }] });
    }
    return out;
  }
}

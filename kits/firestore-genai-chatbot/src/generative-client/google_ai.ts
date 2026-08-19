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

import { GoogleGenerativeAI, type SafetySetting } from "@google/generative-ai";
import { logger } from "../logger";
import { DiscussionClient, type Message } from "./base_class";
import { answerText } from "./parts";

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
  safetySettings: SafetySetting[];
}

type ApiMessage = {
  role: string;
  parts: { text: string }[];
};

enum Role {
  USER = "user",
  GEMINI = "model",
}

/** Chat client backed by the Google AI (Generative Language) SDK. */
export class GeminiDiscussionClient extends DiscussionClient<
  GoogleGenerativeAI,
  GeminiChatOptions,
  ApiMessage
> {
  modelName: string;

  constructor({ apiKey, modelName }: { apiKey?: string; modelName: string }) {
    super();
    if (!apiKey) {
      throw new Error("API key required.");
    }
    if (!modelName) {
      throw new Error("Model name required.");
    }
    this.modelName = modelName;
    this.client = new GoogleGenerativeAI(apiKey);
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

    const model = this.client.getGenerativeModel({ model: this.modelName });

    const chatSession = model.startChat({
      history: this.messagesToApi(history),
      generationConfig: {
        topP: options.topP,
        topK: options.topK,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        candidateCount: options.candidateCount,
      },
      safetySettings: options.safetySettings,
    });

    const result = await chatSession
      .sendMessage(latestApiMessage.parts[0].text)
      .catch((e) => {
        logger.error("Failed to generate response", e);
        // The upstream error can expose the API key, so surface a safe message.
        throw new Error(
          "Failed to generate response, see function logs for more details."
        );
      });

    const text = answerText(result.response.candidates?.[0]?.content?.parts);

    if (!text) {
      throw new Error("No text returned candidate");
    }

    return {
      response: text,
      candidates:
        result.response.candidates?.map(
          (c) => answerText(c.content.parts) ?? ""
        ) ?? [],
      safetyMetadata: result.response.promptFeedback,
      history,
    };
  }

  private messagesToApi(messages: Message[]) {
    const out: any[] = [];
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

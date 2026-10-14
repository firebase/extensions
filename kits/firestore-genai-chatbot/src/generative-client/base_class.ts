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

export interface Message {
  path?: string;
  prompt?: string;
  response?: string;
}

export interface ChatResponse {
  response: string;
  candidates: string[];
  safetyMetadata?: any;
  history: Message[];
}

/**
 * Base class for provider-specific chat clients. Subclasses implement
 * {@link createApiMessage} and {@link generateResponse}; this class handles the
 * common history assembly (prepending the system context as a turn).
 */
export abstract class DiscussionClient<
  Client,
  ChatOptions extends {
    history?: Message[];
    context?: string;
  },
  ApiMessage
> {
  client?: Client;

  private getHistory(options: ChatOptions): Message[] {
    let history: Message[] = [];

    if (options.context) {
      const contextMessage = {
        prompt: `System prompt: ${options.context}.`,
        response: "Understood.",
      };
      history = [contextMessage];
    }
    if (options.history) {
      history = [...history, ...options.history];
    }
    return history;
  }

  async send(
    messageContent: string,
    options: ChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error("Client not initialized.");
    }
    const history = this.getHistory(options);
    const latestApiMessage = this.createApiMessage(messageContent);
    return await this.generateResponse(history, latestApiMessage, options);
  }

  createApiMessage(
    _messageContent: string,
    _role: "user" | "model" = "user"
  ): ApiMessage {
    throw new Error("Method Not implemented");
  }

  async generateResponse(
    _history: Message[],
    _latestApiMessage: ApiMessage,
    _options: ChatOptions
  ): Promise<ChatResponse> {
    throw new Error("Not implemented");
  }
}

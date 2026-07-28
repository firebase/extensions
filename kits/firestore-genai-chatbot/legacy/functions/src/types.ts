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

import { SafetySetting as VertexSafetySetting } from "@google-cloud/vertexai";
import { SafetySetting as GoogleAISafetySetting } from "@google/generative-ai";

// our own types

export interface Message {
  path?: string;
  prompt?: string;
  response?: string;
}

export interface DiscussionOptions {
  /**
   * Any text that should be provided to the model to ground the response.
   * If not empty, this will be the given to the model first.
   * This can be a description of your prompt to the model to help provide
   * context and guide the responses. Examples: "Translate the phrase from
   * English to French." or "Given a statement, classify the sentiment as happy,
   * sad or neutral."
   */
  context?: string;
  /**
   * Instructions or examples of what the model should generate in response to
   * the input message. This includes both sample user input and model output
   * the model should emulate.
   */
  examples?: Message[];
  /**
   * Overrides the default API endpoint.
   */
  apiOrigin?: string;
  /**
   * Provide a model id to use for this discussion. Defaults to 'lamda_api'.
   */
  model?: string;
  /**
   * Set temperature for this discussion.
   */
  temperature?: number;
  /**
   * Set P for this discussion.
   */
  topP?: number;
  /**
   * Set topK for this discussion.
   */
  topK?: number;
  /**
   * Set candidateCount for this discussion.
   **/
  candidateCount?: number;
}

export interface GenerateMessageOptions {
  /**
   * Provide a message history to continue a conversation.
   */
  history?: Message[];
  /**
   * Set or override temperature for this request.
   */
  temperature?: number;
  /**
   * Set or override temperature for this request.
   */
  topP?: number;
  /**
   * Set or override temperature for this request.
   */
  topK?: number;
  /**
   * Set or override context context for this request.
   */
  context?: string;
  /**
   * Adds additional examples if specified.
   */
  examples?: Message[];
  /**
   * Select or override the model for this request.
   */
  model?: string;
  /**
   * Set candidateCount for this discussion.
   **/
  candidateCount?: number;

  safetySettings?: VertexSafetySetting[] | GoogleAISafetySetting[];
  /**
   * Pass a previously returned response to continue a conversation.
   */
  continue?: GenerateMessageResponse;
  /**
   * Controls the length of the response, if possible.
   */
  maxOutputTokens?: number;
}

export interface GenerateMessageResponse {
  response: string;
  history: Message[];
  candidates: string[];
}

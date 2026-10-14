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

import type { SafetySetting } from "./export-config";

/** A single turn in a conversation. */
export interface Message {
  path?: string;
  prompt?: string;
  response?: string;
}

/** Options resolved for a single generation request. */
export interface GenerateMessageOptions {
  /** Prior conversation turns to continue. */
  history?: Message[];
  temperature?: number;
  topP?: number;
  topK?: number;
  /** Grounding/system context for this request. */
  context?: string;
  /** Few-shot examples. */
  examples?: Message[];
  /** Override the model for this request. */
  model?: string;
  candidateCount?: number;
  safetySettings?: SafetySetting[];
  /** A previously returned response to continue a conversation. */
  continue?: GenerateMessageResponse;
  maxOutputTokens?: number;
}

/** A generation result. */
export interface GenerateMessageResponse {
  response: string;
  history: Message[];
  candidates: string[];
}

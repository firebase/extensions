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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { ResolvedGenaiChatbotConfig } from "./export-config";
import { fetchDiscussionOptions, fetchHistory } from "./firestore";
import { getGenerativeClient } from "./generative-client";
import type { GenerateMessageOptions } from "./types";

/**
 * Builds the processing function that the onWrite processor runs for each new
 * message: assembles history, applies any per-discussion overrides, calls the
 * model, and returns the document update (response, and candidates when more
 * than one was requested).
 *
 * @param config - The resolved chatbot configuration.
 * @returns A function mapping a prompt + message snapshot to the update object.
 */
export function createGenerateChatResponse(config: ResolvedGenaiChatbotConfig) {
  const shouldAddCandidatesField =
    config.candidatesField &&
    config.candidateCount &&
    config.candidateCount > 1;

  return async function generateChatResponse(
    prompt: string,
    after: DocumentSnapshot
  ): Promise<Record<string, string | string[]>> {
    const ref = after.ref;
    const history = await fetchHistory(ref, config);

    let requestOptions: GenerateMessageOptions = {
      history,
      context: config.context,
      maxOutputTokens: config.maxOutputTokens,
      safetySettings: config.safetySettings || [],
    };

    if (config.enableDiscussionOptionOverrides) {
      const discussionOptions = await fetchDiscussionOptions(ref);
      requestOptions = { ...requestOptions, ...discussionOptions };
    }

    const discussionClient = getGenerativeClient(config);
    const result = await discussionClient.send(prompt, requestOptions);
    const response = result.response;

    if (typeof response !== "string") {
      throw new Error("No response returned from generative client.");
    }

    if (shouldAddCandidatesField) {
      const candidatesField = config.candidatesField;
      const candidates = result.candidates;

      if (!candidatesField || !Array.isArray(candidates)) {
        throw new Error("No candidates returned from generative client.");
      }

      return {
        [config.responseField]: response,
        [candidatesField]: candidates,
      };
    }

    return {
      [config.responseField]: response,
    };
  };
}

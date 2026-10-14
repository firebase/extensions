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

import type { DocumentReference } from "firebase-admin/firestore";
import type { ResolvedGenaiChatbotConfig } from "./export-config";
import { extractOverrides } from "./overrides";
import type { GenerateMessageOptions, Message } from "./types";

/** Utils for extracting conversation info from Firestore. */

/**
 * Builds the prior conversation history for a message document: every sibling
 * message ordered before it.
 *
 * @param ref - The message document reference.
 * @param config - The resolved chatbot config (field names).
 * @returns The ordered history messages.
 */
export async function fetchHistory(
  ref: DocumentReference,
  config: ResolvedGenaiChatbotConfig
): Promise<Message[]> {
  const { promptField, responseField, orderField } = config;

  const collSnap = await ref.parent.orderBy(orderField).get();

  const refData = await ref.get();
  const refOrderFieldVal = refData.get(orderField);

  // Keep only docs that have an order field strictly before the current doc.
  // TODO(migration): inherited verbatim from the legacy extension — comparing
  // Firestore Timestamps with `<` relies on Timestamp.valueOf(); works on modern
  // @google-cloud/firestore but is fragile for non-Timestamp orderFields.
  // Consider index-of-current-doc slicing instead. Deferred from PR #431 review.
  return collSnap.docs
    .filter(
      (snap) => snap.get(orderField) && snap.get(orderField) < refOrderFieldVal
    )
    .map((snap) => ({
      path: snap.ref.path,
      prompt: snap.get(promptField),
      response: snap.get(responseField),
    }));
}

/**
 * Reads per-discussion option overrides (and examples/continue history) from the
 * parent discussion document.
 *
 * @param ref - The message document reference.
 * @returns Override options, or an empty object when none apply.
 */
export async function fetchDiscussionOptions(
  ref: DocumentReference
): Promise<GenerateMessageOptions> {
  const discussionDocRef = ref.parent.parent;

  if (!discussionDocRef) return {};

  const discussionDocSnap = await discussionDocRef.get();

  if (!discussionDocSnap.exists) return {};

  const overrides = extractOverrides(
    discussionDocSnap
  ) as GenerateMessageOptions;

  if (discussionDocSnap.get("examples")) {
    const examples = discussionDocSnap.get("examples");
    const validatedExamples = validateExamples(examples);
    if (validatedExamples.length > 0) {
      overrides.examples = validatedExamples;
    }
  }

  if (discussionDocSnap.get("continue")) {
    const continueHistory = discussionDocSnap.get("continue");
    const validatedContinueHistory = validateExamples(continueHistory);
    if (validatedContinueHistory.length > 0) {
      overrides.examples = validatedContinueHistory;
    }
  }

  return overrides;
}

function validateExamples(examples: Record<string, unknown>[]): Message[] {
  if (!Array.isArray(examples)) {
    throw new Error(`Invalid examples: ${JSON.stringify(examples)}`);
  }
  const validExamples: Message[] = [];
  for (const example of examples) {
    const prompt = example.prompt;
    const response = example.response;
    if (typeof prompt !== "string" || typeof response !== "string") {
      throw new Error(
        `Invalid examples or continue history: ${JSON.stringify(example)}`
      );
    }
    validExamples.push(example as Message);
  }
  return validExamples;
}

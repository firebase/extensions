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
import type { Change, FirestoreEvent } from "firebase-functions/firestore";
import { createErrorMessage } from "./errors";
import type { ResolvedGenaiChatbotConfig } from "./export-config";
import { FirestoreOnWriteProcessor } from "./firestore-onwrite-processor";
import { createGenerateChatResponse } from "./generate-chat-response";

/** The Firestore document-write event passed to {@link handleDocumentWrite}. */
export type DocumentWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

/** Everything a handler needs, built once by the entry point. */
export interface HandlerContext {
  processor: FirestoreOnWriteProcessor<
    string,
    Record<string, string | string[]>
  >;
}

/**
 * Builds the onWrite processor for a resolved config, wiring the chat-response
 * generator as the processing function and the error mapper.
 *
 * @param config - The resolved chatbot configuration.
 * @returns A configured {@link FirestoreOnWriteProcessor}.
 */
export function createProcessor(
  config: ResolvedGenaiChatbotConfig
): FirestoreOnWriteProcessor<string, Record<string, string | string[]>> {
  return new FirestoreOnWriteProcessor<
    string,
    Record<string, string | string[]>
  >({
    inputField: config.promptField,
    processFn: createGenerateChatResponse(config),
    errorFn: createErrorMessage,
  });
}

/**
 * Handles a Firestore document write by running it through the message
 * processor (which generates a response and writes it back, with a status
 * state-machine).
 *
 * @param event - The Firestore document-write event.
 * @param ctx - The handler context.
 */
export async function handleDocumentWrite(
  event: DocumentWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  const change = event.data;
  if (!change) return;
  return ctx.processor.run(change);
}

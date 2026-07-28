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

/**
 * Public library surface:
 *
 * - {@link handleDocumentWrite} / {@link createProcessor} — the raw handler and
 *   processor, for consumers who want to own trigger registration.
 *
 * Importing this module has no side effects (it reads no environment), so it is
 * safe to import anywhere. The clone-and-deploy entry point (`./index`) reads
 * env params and registers the function.
 */

// Config types + helpers
export {
  type GenaiChatbotConfig,
  GenerativeAIProvider,
  type ResolvedGenaiChatbotConfig,
  resolveConfig,
  type SafetySetting,
} from "./export-config";
// Generative client (for custom pipelines)
export { getGenerativeClient } from "./generative-client";
// Handlers
export {
  createProcessor,
  type DocumentWriteEvent,
  type HandlerContext,
  handleDocumentWrite,
} from "./handlers";
export type {
  GenerateMessageOptions,
  GenerateMessageResponse,
  Message,
} from "./types";

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
 * Side-effect-free library surface:
 *
 * - The handlers, for consumers who want to own trigger registration
 *   themselves. Each takes an injected {@link HandlerContext}.
 * - Config types and helpers for building that context.
 * - The changelog schema and the document serializer, for consumers reading the
 *   changelog or reimplementing the restoration side.
 *
 * Importing this module has no side effects (it reads no environment and opens
 * no clients), so it is safe to import anywhere. The main entry point
 * (`./index`) is the one that reads env params and exports wired functions.
 */

// Config
export {
  type CaptureConfig,
  type LogLevel,
  type ResolvedCaptureConfig,
  resolveCaptureConfig,
  toPipelineCollectionId,
} from "./capture-config";
// Changelog wire format
export {
  CHANGELOG_SCHEMA,
  type ChangelogRow,
  type ChangeType,
} from "./changelog";
// Handlers
export {
  type DocumentWriteEvent,
  getChangeType,
  handleChangelogTask,
  handleDocumentWrite,
  handleRestorationRequest,
  handleRestorationTask,
  type HandlerContext,
  isValidRestorationTimestamp,
  type RestorationJob,
  type RestorationRequest,
  type RestorationResponse,
} from "./handlers";
// Serialization
export {
  type SerializedDocument,
  type SerializedType,
  type SerializedValue,
  serializeDocument,
} from "./serializer";

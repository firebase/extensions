/*
 * Copyright 2019 Google LLC
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
 * - {@link handleDocumentWrite} — the handler, for consumers who want to own
 *   trigger registration themselves. It takes an injected
 *   {@link HandlerContext}.
 * - Config types and helpers ({@link ExportConfig}, {@link resolveExportConfig},
 *   {@link toTrackerConfig}) for building that context.
 *
 * Importing this module has no side effects (it reads no environment), so it is
 * safe to import anywhere. The main entry point (`./index`) is the one that
 * reads env params and exports the wired functions.
 *
 * The change-tracker engine is an internal dependency and is deliberately not
 * re-exported; only the types the handler signatures need are surfaced.
 */

// Engine types referenced by the handler and config signatures. Type-only —
// the engine itself is internal. `ChangeType` is exported for handler tests and
// advanced consumers that build Firestore events directly.
export {
  type ChangeTrackerConfig,
  ChangeType,
  type FirestoreBigQueryEventHistoryTracker,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
// Config types and helpers
export {
  type ExportConfig,
  type ResolvedExportConfig,
  resolveExportConfig,
  toTrackerConfig,
  type ViewType,
} from "./export-config";
// Handlers
export {
  type DocumentWriteEvent,
  type HandlerContext,
  type SerializedDocumentChange,
  handleDocumentWrite,
  handleSyncBigQueryTask,
} from "./handlers";

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
 * - {@link handleProcessMessage} / {@link handleUpsertTransferConfig} — the
 *   handlers, for consumers who want to own trigger registration themselves.
 *   They take an injected {@link HandlerContext}.
 * - Config types and helpers ({@link ExportConfig}, {@link resolveExportConfig},
 *   {@link topicResourceName}) for building that context.
 * - The DTS request builders and resource-name parsers, plus
 *   {@link convertUnsupportedDataTypes}, for advanced consumers and tests.
 *
 * Importing this module has no side effects (it reads no environment), so it is
 * safe to import anywhere. The main entry point (`./index`) is the one that
 * reads env params and exports the wired functions.
 */

// Config types and helpers
export {
  type ExportConfig,
  type ResolvedExportConfig,
  resolveExportConfig,
  topicResourceName,
} from "./export-config";
// DTS request builders and parsers
export {
  PARTITIONING_FIELD_REMOVAL_ERROR,
  PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX,
  type ParsedTransferConfigName,
  type ParsedTransferRunName,
  constructUpdateTransferConfigRequest,
  createTransferConfigRequest,
  parseTransferConfigName,
  parseTransferRunName,
} from "./dts";
// Row-type conversion
export { convertUnsupportedDataTypes } from "./convert";
// Handlers
export {
  type HandlerContext,
  type TransferRunEvent,
  handleProcessMessage,
  handleUpsertTransferConfig,
  metadataServerServiceAccountEmail,
} from "./handlers";
// Payload types
export type {
  BigQueryRow,
  FirestoreRow,
  LogLevel,
  TransferRunMessage,
  TransferRunPayload,
  TransferRunState,
} from "./types";

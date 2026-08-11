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
 * Side-effect-free library surface. Importing this module registers no
 * functions, lifecycle hooks, roles, or APIs and reads no environment params.
 */

export {
  constructUpdateTransferConfigRequest,
  createTransferConfig,
  createTransferConfigRequest,
  type DataTransferClient,
  getTransferConfig,
  PARTITIONING_FIELD_REMOVAL_ERROR,
  PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX,
  type TransferConfig,
  updateTransferConfig,
} from "./dts";
export {
  type BigqueryFirestoreExportConfig,
  type DeployTimeOptions,
  type LogLevel,
  type ResolvedBigqueryFirestoreExportConfig,
  resolveConfig,
} from "./export-config";
export {
  type HandlerContext,
  handleMessagePublished,
  handleUpsertTransferConfig,
  type TransferRunEvent,
} from "./handlers";
export {
  convertUnsupportedDataTypes,
  getBigqueryResults,
  handleTransferRunMessage,
  type ParsedTransferConfigName,
  type ParsedTransferRunName,
  parseTransferConfigName,
  parseTransferRunName,
  type ResultHandlerContext,
  transferConfigAssociatedWithInstance,
  updateLatestRunDocument,
  writeRunResultsToFirestore,
} from "./helper";
export { metadata } from "./metadata";
export type {
  BigQueryRow,
  BigQueryRowValue,
  FirestoreRow,
  FirestoreRowValue,
  TransferRunMessage,
  TransferRunParams,
  TransferRunPayload,
  TransferRunState,
} from "./types";

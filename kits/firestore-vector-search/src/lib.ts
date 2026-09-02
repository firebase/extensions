/**
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

export {
  type BackfillDocumentData,
  type BackfillMetadata,
  type BackfillProcess,
  type BackfillTaskData,
  type ChunkResult,
} from "./backfill";
export { configFromEnv, geminiApiKey, openAiApiKey } from "./config";
export { createEmbedClient, type EmbedClient } from "./embeddings";
export {
  type DistanceMeasure,
  type EmbeddingProvider,
  type QueueNames,
  type ResolvedVectorSearchConfig,
  resolveVectorSearchConfig,
  type VectorSearchConfig,
} from "./export-config";
export {
  type HandlerContext,
  handleBackfillTask,
  handleBackfillTrigger,
  handleEmbedOnWrite,
  handleInit,
  handleQueryCall,
  handleQueryOnWrite,
  handleUpdateTask,
  handleUpdateTrigger,
  type VectorTaskData,
} from "./handlers";
export {
  type ParsedQueryRequest,
  type Prefilter,
  parseLimit,
  parseQuerySchema,
  prefilterSchema,
} from "./queries";
export { type CreateIndexOptions, createIndex } from "./queries/setup";
export { FirestoreVectorStoreClient } from "./vector-store";

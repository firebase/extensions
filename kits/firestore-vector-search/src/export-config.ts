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

export type EmbeddingProvider =
  | "gemini"
  | "multimodal"
  | "openai"
  | "vertex"
  | "custom";

export type DistanceMeasure = "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";

export interface QueueNames {
  updateTrigger: string;
  updateTask: string;
  backfillTrigger: string;
  backfillTask: string;
}

export interface VectorSearchConfig {
  embeddingProvider?: EmbeddingProvider;
  geminiApiKey?: string;
  openAiApiKey?: string;
  customEmbeddingsEndpoint?: string;
  customEmbeddingsBatchSize?: number;
  customEmbeddingsDimension?: number;
  collectionPath?: string;
  defaultQueryLimit?: number;
  distanceMeasure?: DistanceMeasure;
  inputFieldName?: string;
  outputFieldName?: string;
  statusFieldName?: string;
  doBackfill?: boolean;
  updateOnConfigure?: boolean;
  region?: string;
  projectId: string;
  bucketName?: string;
  instanceId?: string;
  queueNames?: Partial<QueueNames>;
}

export interface ResolvedVectorSearchConfig {
  embeddingProvider: EmbeddingProvider;
  geminiApiKey?: string;
  openAiApiKey?: string;
  customEmbeddingsEndpoint?: string;
  customEmbeddingsBatchSize?: number;
  customEmbeddingsDimension?: number;
  collectionPath: string;
  defaultQueryLimit: number;
  distanceMeasure: DistanceMeasure;
  inputFieldName: string;
  outputFieldName: string;
  statusFieldName: string;
  doBackfill: boolean;
  updateOnConfigure: boolean;
  region?: string;
  projectId: string;
  bucketName: string;
  instanceId: string;
  queueNames: QueueNames;
  dimension: number;
  indexMetadataDocumentPath: string;
  queryCollectionPath: string;
}

const DEFAULT_INSTANCE_ID = "firestore-vector-search";
const DEFAULT_COLLECTION_PATH = "products";
const DEFAULT_QUERY_LIMIT = 3;

export const QUERY_COLLECTION_PATH = `_${DEFAULT_INSTANCE_ID}/index/queries`;

function dimensionFor(config: VectorSearchConfig): number {
  switch (config.embeddingProvider ?? "gemini") {
    case "gemini":
    case "vertex":
      return 768;
    case "multimodal":
      return 1408;
    case "openai":
      return 512;
    case "custom":
      if (!config.customEmbeddingsDimension) {
        throw new Error(
          "Custom embeddings require customEmbeddingsDimension to be set"
        );
      }
      return config.customEmbeddingsDimension;
  }
}

function resolveQueueNames(queueNames: Partial<QueueNames> = {}): QueueNames {
  return {
    updateTrigger: queueNames.updateTrigger ?? "updateTrigger",
    updateTask: queueNames.updateTask ?? "updateTask",
    backfillTrigger: queueNames.backfillTrigger ?? "backfillTrigger",
    backfillTask: queueNames.backfillTask ?? "backfillTask",
  };
}

export function resolveVectorSearchConfig(
  config: VectorSearchConfig
): ResolvedVectorSearchConfig {
  const instanceId = config.instanceId ?? DEFAULT_INSTANCE_ID;
  const projectId = config.projectId;
  return {
    embeddingProvider: config.embeddingProvider ?? "gemini",
    geminiApiKey: config.geminiApiKey,
    openAiApiKey: config.openAiApiKey,
    customEmbeddingsEndpoint: config.customEmbeddingsEndpoint,
    customEmbeddingsBatchSize: config.customEmbeddingsBatchSize,
    customEmbeddingsDimension: config.customEmbeddingsDimension,
    collectionPath: config.collectionPath ?? DEFAULT_COLLECTION_PATH,
    defaultQueryLimit: config.defaultQueryLimit ?? DEFAULT_QUERY_LIMIT,
    distanceMeasure: config.distanceMeasure ?? "COSINE",
    inputFieldName: config.inputFieldName ?? "input",
    outputFieldName: config.outputFieldName ?? "embedding",
    statusFieldName: config.statusFieldName ?? "status",
    doBackfill: config.doBackfill ?? false,
    updateOnConfigure: config.updateOnConfigure ?? false,
    region: config.region ?? process.env.FUNCTION_REGION,
    projectId,
    bucketName: config.bucketName ?? `${projectId}.appspot.com`,
    instanceId,
    queueNames: resolveQueueNames(config.queueNames),
    dimension: dimensionFor(config),
    indexMetadataDocumentPath: `_${instanceId}/index`,
    queryCollectionPath: `_${instanceId}/index/queries`,
  };
}

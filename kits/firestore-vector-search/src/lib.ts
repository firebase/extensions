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

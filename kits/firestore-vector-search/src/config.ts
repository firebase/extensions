import {
  defineBoolean,
  defineInt,
  defineSecret,
  defineString,
  projectID,
} from "firebase-functions/params";
import type { VectorSearchConfig } from "./export-config";

export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const openAiApiKey = defineSecret("OPENAI_API_KEY");

const params = {
  embeddingProvider: defineString("EMBEDDING_PROVIDER", { default: "gemini" }),
  customEmbeddingsEndpoint: defineString("CUSTOM_EMBEDDINGS_ENDPOINT", {
    default: "",
  }),
  customEmbeddingsBatchSize: defineInt("CUSTOM_EMBEDDINGS_BATCH_SIZE", {
    default: 0,
  }),
  customEmbeddingsDimension: defineInt("CUSTOM_EMBEDDINGS_DIMENSION", {
    default: 0,
  }),
  collectionPath: defineString("COLLECTION_NAME", { default: "products" }),
  defaultQueryLimit: defineInt("DEFAULT_QUERY_LIMIT", { default: 3 }),
  distanceMeasure: defineString("DISTANCE_MEASURE", { default: "COSINE" }),
  inputFieldName: defineString("INPUT_FIELD_NAME", { default: "input" }),
  outputFieldName: defineString("OUTPUT_FIELD_NAME", { default: "embedding" }),
  statusFieldName: defineString("STATUS_FIELD_NAME", { default: "status" }),
  doBackfill: defineBoolean("DO_BACKFILL", { default: false }),
  updateOnConfigure: defineBoolean("UPDATE_ON_CONFIGURE", { default: false }),
  region: defineString("LOCATION", { default: "us-central1" }),
  bucketName: defineString("BUCKET_NAME", { default: "" }),
  instanceId: defineString("INSTANCE_ID", {
    default: "firestore-vector-search",
  }),
  updateTriggerQueueName: defineString("UPDATE_TRIGGER_QUEUE_NAME", {
    default: "updateTrigger",
  }),
  updateTaskQueueName: defineString("UPDATE_TASK_QUEUE_NAME", {
    default: "updateTask",
  }),
  backfillTriggerQueueName: defineString("BACKFILL_TRIGGER_QUEUE_NAME", {
    default: "backfillTrigger",
  }),
  backfillTaskQueueName: defineString("BACKFILL_TASK_QUEUE_NAME", {
    default: "backfillTask",
  }),
};

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalNumber(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

export function configFromEnv(): VectorSearchConfig {
  return {
    embeddingProvider:
      params.embeddingProvider.value() as VectorSearchConfig["embeddingProvider"],
    customEmbeddingsEndpoint: optionalString(
      params.customEmbeddingsEndpoint.value()
    ),
    customEmbeddingsBatchSize: optionalNumber(
      params.customEmbeddingsBatchSize.value()
    ),
    customEmbeddingsDimension: optionalNumber(
      params.customEmbeddingsDimension.value()
    ),
    collectionPath: params.collectionPath.value(),
    defaultQueryLimit: params.defaultQueryLimit.value(),
    distanceMeasure:
      params.distanceMeasure.value() as VectorSearchConfig["distanceMeasure"],
    inputFieldName: params.inputFieldName.value(),
    outputFieldName: params.outputFieldName.value(),
    statusFieldName: params.statusFieldName.value(),
    doBackfill: params.doBackfill.value(),
    updateOnConfigure: params.updateOnConfigure.value(),
    region: params.region.value(),
    projectId: projectID.value(),
    bucketName: optionalString(params.bucketName.value()),
    instanceId: params.instanceId.value(),
    queueNames: {
      updateTrigger: params.updateTriggerQueueName.value(),
      updateTask: params.updateTaskQueueName.value(),
      backfillTrigger: params.backfillTriggerQueueName.value(),
      backfillTask: params.backfillTaskQueueName.value(),
    },
  };
}

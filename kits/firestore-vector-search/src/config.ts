import {
  defineBoolean,
  defineInt,
  defineSecret,
  defineString,
  type Expression,
  expr,
  projectID,
  select,
  storageBucket,
} from "firebase-functions/params";
import type { VectorSearchConfig } from "./export-config";

export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const openAiApiKey = defineSecret("OPENAI_API_KEY");
type ConfigExpression<T extends string | number | boolean> = T | Expression<T>;

export interface ConfigExpressions {
  region: ConfigExpression<string>;
  collectionDocument: ConfigExpression<string>;
  queryCollectionName: ConfigExpression<string>;
}

const EMBEDDING_PROVIDER_OPTIONS = [
  "gemini",
  "multimodal",
  "openai",
  "vertex",
  "custom",
] as const;
const DISTANCE_MEASURE_OPTIONS = [
  "COSINE",
  "EUCLIDEAN",
  "DOT_PRODUCT",
] as const;
const FUNCTION_REGION_OPTIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west2",
  "us-west3",
  "us-west4",
  "europe-central2",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west6",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-south1",
  "asia-southeast2",
  "northamerica-northeast1",
  "southamerica-east1",
  "australia-southeast1",
] as const;

const params = {
  instanceId: defineString("KIT_INSTANCE_ID", {
    default: "firestore-vector-search",
  }),
  embeddingProvider: defineString("EMBEDDING_PROVIDER", {
    default: "gemini",
    input: select([...EMBEDDING_PROVIDER_OPTIONS]),
  }),
  customEmbeddingsEndpoint: defineString("CUSTOM_EMBEDDINGS_ENDPOINT", {
    default: "",
  }),
  customEmbeddingsBatchSize: defineString("CUSTOM_EMBEDDINGS_BATCH_SIZE", {
    default: "",
  }),
  customEmbeddingsDimension: defineString("CUSTOM_EMBEDDINGS_DIMENSION", {
    default: "",
  }),
  collectionPath: defineString("COLLECTION_NAME", { default: "products" }),
  defaultQueryLimit: defineInt("DEFAULT_QUERY_LIMIT", { default: 3 }),
  distanceMeasure: defineString("DISTANCE_MEASURE", {
    default: "COSINE",
    input: select([...DISTANCE_MEASURE_OPTIONS]),
  }),
  inputFieldName: defineString("INPUT_FIELD_NAME", { default: "input" }),
  outputFieldName: defineString("OUTPUT_FIELD_NAME", { default: "embedding" }),
  statusFieldName: defineString("STATUS_FIELD_NAME", { default: "status" }),
  doBackfill: defineBoolean("DO_BACKFILL"),
  updateOnConfigure: defineBoolean("UPDATE_ON_CONFIGURE"),
  region: defineString("LOCATION", {
    input: select([...FUNCTION_REGION_OPTIONS]),
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

export const CONFIG_EXPRESSIONS = {
  region: params.region,
  collectionDocument: expr`${params.collectionPath}/{docId}`,
  queryCollectionName: expr`_${params.instanceId}/index/queries`,
} as const satisfies ConfigExpressions;

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalNumber(value: string): number | undefined {
  const number = Number(value);
  return number > 0 ? number : undefined;
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
    region: optionalString(params.region.value()),
    projectId: projectID.value(),
    instanceId: params.instanceId.value(),
    geminiApiKey: optionalString(geminiApiKey.value()),
    openAiApiKey: optionalString(openAiApiKey.value()),
    bucketName: optionalString(storageBucket.value()),
    queueNames: {
      updateTrigger: params.updateTriggerQueueName.value(),
      updateTask: params.updateTaskQueueName.value(),
      backfillTrigger: params.backfillTriggerQueueName.value(),
      backfillTask: params.backfillTaskQueueName.value(),
    },
  };
}

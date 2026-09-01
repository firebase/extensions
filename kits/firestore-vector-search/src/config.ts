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

export const geminiApiKey = defineSecret("GEMINI_API_KEY", {
  label: "Gemini API key",
  description:
    "If you selected Gemini to calculate embeddings, please provide your Gemini API key",
});
export const openAiApiKey = defineSecret("OPENAI_API_KEY", {
  label: "OpenAI API key",
  description:
    "If you selected OpenAI to calculate embeddings, please provide your OpenAI API key",
});
type ConfigExpression<T extends string | number | boolean> = T | Expression<T>;

export interface ConfigExpressions {
  collectionDocument: ConfigExpression<string>;
  queryCollectionDocument: ConfigExpression<string>;
}

const instanceId = defineString("INSTANCE_ID");

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
const params = {
  instanceId,
  embeddingProvider: defineString("EMBEDDING_PROVIDER", {
    label: "LLM",
    description:
      "Which embedding API do you want to use? Note: **Vertex AI provider** is supported only with the **us-central1** location.",

    default: "gemini",
    input: select({
      Gemini: "gemini",
      Multimodal: "multimodal",
      OpenAI: "openai",
      "Vertex AI": "vertex",
      "Other (User-provided endpoint)": "custom",
    }),
  }),
  customEmbeddingsEndpoint: defineString("CUSTOM_EMBEDDINGS_ENDPOINT", {
    label: "LLM Function",
    description:
      'If you selected "Other" as your embedding provider, please provide the URL of your function that will calculate the embeddings.',

    default: "",
  }),
  customEmbeddingsBatchSize: defineString("CUSTOM_EMBEDDINGS_BATCH_SIZE", {
    label: "LLM Function batch size",
    description:
      'If you selected "Other" as your embedding provider, please provide the batch size of your function that will calculate the embeddings.',

    default: "",
  }),
  customEmbeddingsDimension: defineString("CUSTOM_EMBEDDINGS_DIMENSION", {
    label: "LLM Function dimension",
    description:
      'If you selected "Other" as your embedding provider, please provide the dimension of the embedding you will be using.',

    default: "",
  }),
  collectionPath: defineString("COLLECTION_NAME", {
    label: "Collection path",
    description:
      "What is the path to the collection that contains the strings that you want to embed?",

    default: "products",
    input: {
      text: {
        example: "products",

        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  // Extension regex and error message, kept verbatim for strict parity: the
  // regex is unanchored and the message is upstream's copy-paste mistake.
  defaultQueryLimit: defineInt("DEFAULT_QUERY_LIMIT", {
    label: "Default query limit",
    description:
      "What is the default number of results to return when making a vector search query?",

    default: 3,
    input: {
      text: {
        validationRegex: /^[1-9][0-9]*/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  distanceMeasure: defineString("DISTANCE_MEASURE", {
    label: "Distance measure",
    description:
      "What distance measure do you want to be used to rank the results of your vector search?",

    default: "COSINE",
    input: select({
      Cosine: "COSINE",
      Euclidean: "EUCLIDEAN",
      "Dot Product": "DOT_PRODUCT",
    }),
  }),
  inputFieldName: defineString("INPUT_FIELD_NAME", {
    label: "Input field name",
    description:
      "What is the name of the field that contains the string that you want to embed?",
    default: "input",
    input: { text: { example: "input" } },
  }),
  outputFieldName: defineString("OUTPUT_FIELD_NAME", {
    label: "Output field name",
    description:
      "What is the name of the field where you want to store your embeddings?",
    default: "embedding",
    input: { text: { example: "embedding" } },
  }),
  statusFieldName: defineString("STATUS_FIELD_NAME", {
    label: "Status field name",
    description:
      "What is the name of the field where you want to track the state of a document being embedded?",
    default: "status",
    input: { text: { example: "status" } },
  }),
  doBackfill: defineBoolean("DO_BACKFILL", {
    label: "Embed existing documents?",
    description:
      "Should existing documents in the Firestore collection be embedded as well?",
  }),
  updateOnConfigure: defineBoolean("UPDATE_ON_CONFIGURE", {
    label: "Update existing embeddings?",
    description:
      "Should existing documents in the Firestore collection be updated with new embeddings on reconfiguring the extensions?",
  }),
  updateTriggerQueueName: defineString("UPDATE_TRIGGER_QUEUE_NAME", {
    default: expr`kit-${instanceId}-updateTrigger`,
  }),
  updateTaskQueueName: defineString("UPDATE_TASK_QUEUE_NAME", {
    default: expr`kit-${instanceId}-updateTask`,
  }),
  backfillTriggerQueueName: defineString("BACKFILL_TRIGGER_QUEUE_NAME", {
    default: expr`kit-${instanceId}-backfillTrigger`,
  }),
  backfillTaskQueueName: defineString("BACKFILL_TASK_QUEUE_NAME", {
    default: expr`kit-${instanceId}-backfillTask`,
  }),
};

export const CONFIG_EXPRESSIONS = {
  collectionDocument: expr`${params.collectionPath}/{docId}`,
  queryCollectionDocument: expr`_${instanceId}/index/queries/{queryId}`,
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
    region: process.env.FUNCTION_REGION,
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

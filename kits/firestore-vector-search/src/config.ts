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
import { firestoreLocationToFunctionRegion } from "./region";

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
}

/**
 * Reads the instance id firebase-tools injects for kit instances (set to the
 * instance's key in firebase.json) during discovery, in the emulator, and on
 * deployed functions. The FIREBASE_ prefix is reserved in .env files and the
 * params machinery never sees injected values, so it is a plain env read, not
 * a defineString. Not evaluated at import: the `./lib` entry re-exports from
 * this module and must load without the variable.
 *
 * @throws If the variable is missing, naming the CLI version that provides it.
 */
export function instanceIdFromEnv(): string {
  const instanceId = process.env.FIREBASE_KIT_INSTANCE_ID;
  if (!instanceId) {
    throw new Error(
      "FIREBASE_KIT_INSTANCE_ID is not set. It is provided automatically to " +
        "kit instances by firebase-tools >= 15.27.0; deploy or emulate this " +
        "kit with a supported CLI version."
    );
  }
  return instanceId;
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
const params = {
  databaseRegion: defineString("DATABASE_REGION", {
    label: "Firestore Instance Location",
    description:
      "Where is the Firestore database located? You can check your current database location at [https://console.cloud.google.com/firestore/databases](https://console.cloud.google.com/firestore/databases). The functions in this kit deploy to the Cloud Run region closest to this location.",

    input: select({
      "Multi-region (Europe - Belgium and Netherlands)": "eur3",
      "Multi-region (United States)": "nam5",
      "Multi-region (Iowa, North Virginia, and Oklahoma)": "nam7",
      "Iowa (us-central1)": "us-central1",
      "Oregon (us-west1)": "us-west1",
      "Los Angeles (us-west2)": "us-west2",
      "Salt Lake City (us-west3)": "us-west3",
      "Las Vegas (us-west4)": "us-west4",
      "South Carolina (us-east1)": "us-east1",
      "Northern Virginia (us-east4)": "us-east4",
      "Columbus (us-east5)": "us-east5",
      "Dallas (us-south1)": "us-south1",
      "Montreal (northamerica-northeast1)": "northamerica-northeast1",
      "Toronto (northamerica-northeast2)": "northamerica-northeast2",
      "Queretaro (northamerica-south1)": "northamerica-south1",
      "Sao Paulo (southamerica-east1)": "southamerica-east1",
      "Santiago (southamerica-west1)": "southamerica-west1",
      "Belgium (europe-west1)": "europe-west1",
      "London (europe-west2)": "europe-west2",
      "Frankfurt (europe-west3)": "europe-west3",
      "Netherlands (europe-west4)": "europe-west4",
      "Zurich (europe-west6)": "europe-west6",
      "Milan (europe-west8)": "europe-west8",
      "Paris (europe-west9)": "europe-west9",
      "Berlin (europe-west10)": "europe-west10",
      "Turin (europe-west12)": "europe-west12",
      "Madrid (europe-southwest1)": "europe-southwest1",
      "Finland (europe-north1)": "europe-north1",
      "Stockholm (europe-north2)": "europe-north2",
      "Warsaw (europe-central2)": "europe-central2",
      "Doha (me-central1)": "me-central1",
      "Dammam (me-central2)": "me-central2",
      "Tel Aviv (me-west1)": "me-west1",
      "Mumbai (asia-south1)": "asia-south1",
      "Delhi (asia-south2)": "asia-south2",
      "Singapore (asia-southeast1)": "asia-southeast1",
      "Jakarta (asia-southeast2)": "asia-southeast2",
      "Taiwan (asia-east1)": "asia-east1",
      "Hong Kong (asia-east2)": "asia-east2",
      "Tokyo (asia-northeast1)": "asia-northeast1",
      "Osaka (asia-northeast2)": "asia-northeast2",
      "Seoul (asia-northeast3)": "asia-northeast3",
      "Sydney (australia-southeast1)": "australia-southeast1",
      "Melbourne (australia-southeast2)": "australia-southeast2",
      "Johannesburg (africa-south1)": "africa-south1",
    }),
  }),
  embeddingProvider: defineString("EMBEDDING_PROVIDER", {
    label: "LLM",
    description:
      "Which embedding API do you want to use? Note: the **Vertex AI provider** embeds in whatever region the functions run in, which is derived from the Firestore database location. A few regions have no Vertex AI embedding endpoint: `africa-south1`, `europe-north2`, `europe-west10`, `europe-west12` and `northamerica-south1`.",

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
    input: select({ Yes: true, No: false }),
  }),
  updateOnConfigure: defineBoolean("UPDATE_ON_CONFIGURE", {
    label: "Update existing embeddings?",
    description:
      "Should existing documents in the Firestore collection be updated with new embeddings on reconfiguring the extensions?",
    input: select({ Yes: true, No: false }),
  }),
  // These name the deployed function, not the fully-qualified queue: the Admin
  // SDK prefixes the name with `kit-<instance id>-` from
  // FIREBASE_KIT_INSTANCE_ID when it resolves the queue.
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
  collectionDocument: expr`${params.collectionPath}/{docId}`,
} as const satisfies ConfigExpressions;

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalNumber(value: string): number | undefined {
  const number = Number(value);
  return number > 0 ? number : undefined;
}

/**
 * Cloud Run region for this kit's functions, derived from the Firestore
 * database location.
 *
 * The location to Cloud Run region lookup needs a nested ternary, which the
 * CLI's CEL subset cannot express, so the value is read from `process.env`
 * (populated from `.env` during CLI discovery) rather than passed as a param
 * expression. `undefined` means the functions declare no region and the
 * CLI falls back to its own default.
 */
export function envFunctionRegion(): string | undefined {
  return firestoreLocationToFunctionRegion(process.env.DATABASE_REGION);
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
    instanceId: instanceIdFromEnv(),
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

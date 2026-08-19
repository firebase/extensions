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

import {
  defineBoolean,
  defineSecret,
  defineString,
  expr,
  select,
} from "firebase-functions/params";
import {
  type DeployTimeOptions,
  type GenaiChatbotConfig,
  GenerativeAIProvider,
  getProjectId,
  type SafetySetting,
} from "./export-config";

const GENERATIVE_AI_PROVIDER_OPTIONS = ["google-ai", "vertex-ai"] as const;
const VERTEX_MODEL_LOCATION_OPTIONS = [
  "null",
  "global",
  "us-east5",
  "us-south1",
  "us-central1",
  "us-west4",
  "us-east1",
  "us-east4",
  "us-west1",
  "northamerica-northeast1",
  "southamerica-east1",
  "europe-west4",
  "europe-west9",
  "europe-west2",
  "europe-west3",
  "europe-west1",
  "europe-west6",
  "europe-southwest1",
  "europe-west8",
  "europe-north1",
  "europe-central2",
  "asia-northeast1",
  "australia-southeast1",
  "asia-southeast1",
  "asia-northeast3",
  "asia-east1",
  "asia-east2",
  "asia-south1",
  "me-central2",
  "me-central1",
  "me-west1",
] as const;
const SAFETY_THRESHOLD_OPTIONS = [
  "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
  "BLOCK_LOW_AND_ABOVE",
  "BLOCK_MEDIUM_AND_ABOVE",
  "BLOCK_ONLY_HIGH",
  "BLOCK_NONE",
] as const;

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`. Names match the original
 * extension so an existing configuration is a lift-and-shift.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  provider: defineString("GENERATIVE_AI_PROVIDER", {
    default: "google-ai",
    input: select([...GENERATIVE_AI_PROVIDER_OPTIONS]),
  }),
  apiKey: defineSecret("API_KEY"),
  model: defineString("MODEL", { default: "gemini-3.6-flash" }),
  /**
   * Vertex AI location for the model. Defaults to `global` rather than the
   * function region: Gemini 3.x is served on the `global`, `us` and `eu`
   * endpoints only, so a single region such as `us-central1` returns 404 for the
   * default `gemini-3.6-flash`. Set a specific region only with a model that is
   * served there (for example a Gemini 2.5 model).
   *
   * @see https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
   */
  vertexModelLocation: defineString("VERTEX_AI_MODEL_LOCATION", {
    default: "global",
    input: select([...VERTEX_MODEL_LOCATION_OPTIONS]),
  }),
  collectionName: defineString("COLLECTION_NAME", { default: "generate" }),
  promptField: defineString("PROMPT_FIELD", { default: "prompt" }),
  responseField: defineString("RESPONSE_FIELD", { default: "response" }),
  orderField: defineString("ORDER_FIELD", { default: "createTime" }),
  candidatesField: defineString("CANDIDATES_FIELD", {
    default: "candidates",
  }),
  context: defineString("CONTEXT", { default: "" }),
  /**
   * Sampling controls. Gemini 3.x deprecates `temperature`, `topP` and `topK`;
   * the Vertex AI model card for `gemini-3.6-flash` states custom values are
   * ignored. They still apply to Gemini 2.5 models, which retire in October
   * 2026, so the params are kept for existing configurations.
   */
  temperature: defineString("TEMPERATURE", { default: "" }),
  topP: defineString("TOP_P", { default: "" }),
  topK: defineString("TOP_K", { default: "" }),
  candidateCount: defineString("CANDIDATE_COUNT", { default: "1" }),
  maxOutputTokens: defineString("MAX_OUTPUT_TOKENS", { default: "" }),
  enableOverrides: defineBoolean("ENABLE_DISCUSSION_OPTION_OVERRIDES", {
    default: false,
  }),
  enableGenkitMonitoring: defineBoolean("ENABLE_GENKIT_MONITORING", {
    default: false,
  }),
  harmHateSpeech: defineString("HARM_CATEGORY_HATE_SPEECH", {
    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select([...SAFETY_THRESHOLD_OPTIONS]),
  }),
  harmDangerous: defineString("HARM_CATEGORY_DANGEROUS_CONTENT", {
    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select([...SAFETY_THRESHOLD_OPTIONS]),
  }),
  harmHarassment: defineString("HARM_CATEGORY_HARASSMENT", {
    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select([...SAFETY_THRESHOLD_OPTIONS]),
  }),
  harmSexual: defineString("HARM_CATEGORY_SEXUALLY_EXPLICIT", {
    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select([...SAFETY_THRESHOLD_OPTIONS]),
  }),
};

/** The secret bound on the function so its value is available at runtime. */
export const apiKeySecret = params.apiKey;

/** Coerce an empty-string param value to `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function num(value: string): number | undefined {
  const v = optional(value);
  return v ? Number(v) : undefined;
}

function buildSafetySettings(): SafetySetting[] {
  const entries: Array<[string, string]> = [
    ["HARM_CATEGORY_HATE_SPEECH", params.harmHateSpeech.value()],
    ["HARM_CATEGORY_DANGEROUS_CONTENT", params.harmDangerous.value()],
    ["HARM_CATEGORY_HARASSMENT", params.harmHarassment.value()],
    ["HARM_CATEGORY_SEXUALLY_EXPLICIT", params.harmSexual.value()],
  ];
  return entries
    .filter(([, threshold]) => threshold.length > 0)
    .map(([category, threshold]) => ({ category, threshold }));
}

/**
 * Resolves all deploy-time params into a {@link GenaiChatbotConfig}.
 *
 * @returns The chatbot configuration assembled from environment params.
 */
export function configFromEnv(): GenaiChatbotConfig {
  const vertexModelLocation = optional(params.vertexModelLocation.value());

  return {
    provider:
      (optional(params.provider.value()) as GenerativeAIProvider) ??
      GenerativeAIProvider.GOOGLE_AI,
    apiKey: params.apiKey.value(),
    model: params.model.value(),
    vertexModelLocation:
      vertexModelLocation === "null" ? undefined : vertexModelLocation,
    projectId: getProjectId(),
    collectionName: optional(params.collectionName.value()),
    promptField: optional(params.promptField.value()),
    responseField: optional(params.responseField.value()),
    orderField: optional(params.orderField.value()),
    candidatesField: optional(params.candidatesField.value()),
    context: optional(params.context.value()),
    temperature: num(params.temperature.value()),
    topP: num(params.topP.value()),
    topK: num(params.topK.value()),
    candidateCount: num(params.candidateCount.value()),
    maxOutputTokens: num(params.maxOutputTokens.value()),
    enableOverrides: params.enableOverrides.value(),
    enableGenkitMonitoring: params.enableGenkitMonitoring.value(),
    safetySettings: buildSafetySettings(),
    secrets: [apiKeySecret],
  };
}

/**
 * Builds the {@link DeployTimeOptions} for the params-driven entry point.
 *
 * The document path remains a CEL parameter expression so the Firebase CLI can
 * resolve it after loading `.env`.
 *
 * @returns Deploy-time options wired from environment params.
 */
export function envDeployOptions(): DeployTimeOptions {
  return {
    // CEL: `{{ params.COLLECTION_NAME }}/{messageId}` — the param resolves from
    // `.env`, the `{messageId}` wildcard stays literal (matches extension.yaml's
    // `${COLLECTION_NAME}/{messageId}` trigger resource).
    document: expr`${params.collectionName}/{messageId}`,
  };
}

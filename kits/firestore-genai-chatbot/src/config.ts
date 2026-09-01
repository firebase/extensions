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

const ZERO_TO_ONE_VALIDATION = {
  text: {
    validationRegex: /^(?:0*(?:\.\d+)?|1(\.0*)?)$/,
    validationErrorMessage:
      "Please specify a decimal representation of a number between 0 and 1.",
  },
};

// Extension regex, kept unanchored for strict parity (trailing junk like
// "5abc" passes, as upstream), with an empty branch added: the params are
// optional.
const POSITIVE_INT_VALIDATION = {
  text: {
    validationRegex: /^[1-9][0-9]*|^$/,
    validationErrorMessage: "Please specify a positive integer.",
  },
};

const params = {
  provider: defineString("GENERATIVE_AI_PROVIDER", {
    label: "Gemini API Provider",
    description:
      "This extension makes use of the Gemini family of generative models. For Google AI you will require an API key, whereas Vertex AI will authenticate using application default credentials. For more information see the [docs](https://firebase.google.com/docs/admin/setup#initialize-sdk).",

    default: "google-ai",
    input: select({ "Google AI": "google-ai", "Vertex AI": "vertex-ai" }),
  }),
  apiKey: defineSecret("API_KEY", {
    label: "Google AI API Key",
    description:
      "If you have selected Google AI as your provider, then this parameter is required. If you have instead selected Vertex AI, then this parameter is not required, and application default credentials will be used.",
  }),
  model: defineString("MODEL", {
    label: "Gemini model",
    description:
      "Input the name of the Gemini model you would like to use. To view available models for each provider, see: [Vertex AI Gemini models](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models), [Google AI Gemini models](https://ai.google.dev/models/gemini). Note: Any models in preview on Vertex AI will require Vertex AI Model Location to be set to 'global'.",
    default: "gemini-2.5-flash",
  }),
  vertexModelLocation: defineString("VERTEX_AI_MODEL_LOCATION", {
    label: "Vertex AI Model Location",
    description:
      "If you are using Vertex AI as your provider, which location should be used for the Vertex AI API? This can differ from the Cloud Functions location.\nIf not specified, defaults to the Cloud Functions location. Note: Models in preview on Vertex AI require 'Global'. See [available locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations).",

    default: "null",
    input: select({
      "Same as Cloud Functions Location (default)": "null",
      "Global (required for preview models)": "global",
      "Columbus, Ohio (us-east5)": "us-east5",
      "Dallas, Texas (us-south1)": "us-south1",
      "Iowa (us-central1)": "us-central1",
      "Las Vegas, Nevada (us-west4)": "us-west4",
      "Moncks Corner, South Carolina (us-east1)": "us-east1",
      "Northern Virginia (us-east4)": "us-east4",
      "Oregon (us-west1)": "us-west1",
      "Montréal (northamerica-northeast1)": "northamerica-northeast1",
      "São Paulo, Brazil (southamerica-east1)": "southamerica-east1",
      "Netherlands (europe-west4)": "europe-west4",
      "Paris, France (europe-west9)": "europe-west9",
      "London, United Kingdom (europe-west2)": "europe-west2",
      "Frankfurt, Germany (europe-west3)": "europe-west3",
      "Belgium (europe-west1)": "europe-west1",
      "Zürich, Switzerland (europe-west6)": "europe-west6",
      "Madrid, Spain (europe-southwest1)": "europe-southwest1",
      "Milan, Italy (europe-west8)": "europe-west8",
      "Finland (europe-north1)": "europe-north1",
      "Warsaw, Poland (europe-central2)": "europe-central2",
      "Tokyo, Japan (asia-northeast1)": "asia-northeast1",
      "Sydney, Australia (australia-southeast1)": "australia-southeast1",
      "Singapore (asia-southeast1)": "asia-southeast1",
      "Seoul, Korea (asia-northeast3)": "asia-northeast3",
      "Taiwan (asia-east1)": "asia-east1",
      "Hong Kong, China (asia-east2)": "asia-east2",
      "Mumbai, India (asia-south1)": "asia-south1",
      "Dammam, Saudi Arabia (me-central2)": "me-central2",
      "Doha, Qatar (me-central1)": "me-central1",
      "Tel Aviv, Israel (me-west1)": "me-west1",
    }),
  }),
  collectionName: defineString("COLLECTION_NAME", {
    label: "Firestore Collection Path",
    description:
      "Used to store conversation history represented as documents. This extension will listen to the specified collection(s) for new message documents.",

    default: "generate",
    input: {
      text: {
        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  promptField: defineString("PROMPT_FIELD", {
    label: "Prompt Field",
    description: "The field in the message document that contains the prompt.",
    default: "prompt",
    input: { text: { example: "prompt" } },
  }),
  responseField: defineString("RESPONSE_FIELD", {
    label: "Response Field",
    description:
      "The field in the message document into which to put the response.",
    default: "response",
    input: { text: { example: "response" } },
  }),
  orderField: defineString("ORDER_FIELD", {
    label: "Order Field",
    description:
      "The field by which to order when fetching conversation history. If absent when processing begins, the current timestamp will be written to this field. Sorting will be in descending order.",
    default: "createTime",
    input: { text: { example: "createTime" } },
  }),
  candidatesField: defineString("CANDIDATES_FIELD", {
    label: "Candidates field",
    description:
      "The field in the message document into which to put the other candidate responses if the candidate count parameter is greater than one.",

    default: "candidates",
  }),
  context: defineString("CONTEXT", {
    label: "Context",
    description:
      "Contextual preamble for the generative AI model. A string giving context for the discussion.",
    default: "",
  }),
  temperature: defineString("TEMPERATURE", {
    label: "Temperature",
    description:
      "Controls the randomness of the output. Values can range over [0,1], inclusive. A value closer to 1 will produce responses that are more varied, while a value closer to 0 will typically result in less surprising responses from the model.",

    default: "",
    input: ZERO_TO_ONE_VALIDATION,
  }),
  topP: defineString("TOP_P", {
    label: "Nucleus sampling probability",
    description:
      "If specified, nucleus sampling will be used as the decoding strategy. Nucleus sampling considers the smallest set of tokens whose probability sum is at least a fixed value. Enter a value between 0 and 1.",

    default: "",
    input: ZERO_TO_ONE_VALIDATION,
  }),
  topK: defineString("TOP_K", {
    label: "Sampling strategy parameter",
    description:
      "If specified, top-k sampling will be used as the decoding strategy. Top-k sampling considers the set of topK most probable tokens.",

    default: "",
    input: POSITIVE_INT_VALIDATION,
  }),
  candidateCount: defineString("CANDIDATE_COUNT", {
    label: "Candidate count",
    description:
      "The default value is one. When set to an integer higher than one, additional candidate responses, up to the specified number, will be stored in Firestore under the 'candidates' field.",

    default: "1",
    input: POSITIVE_INT_VALIDATION,
  }),
  maxOutputTokens: defineString("MAX_OUTPUT_TOKENS", {
    label: "Max Output Tokens",
    description:
      "If specified, this parameter is passed to the Gemini API to control the length of the response.",

    default: "",
    input: POSITIVE_INT_VALIDATION,
  }),
  enableOverrides: defineBoolean("ENABLE_DISCUSSION_OPTION_OVERRIDES", {
    label: "Enable per document overrides.",
    description:
      'If set to "Yes", discussion parameters may be overwritten by fields in the discussion collection.',

    default: false,
  }),
  enableGenkitMonitoring: defineBoolean("ENABLE_GENKIT_MONITORING", {
    label: "Enable Genkit Monitoring",
    description:
      'If set to "Yes", enables Genkit Monitoring for collecting and viewing real-time telemetry data. This requires the Cloud Logging API, Cloud Trace API, and Cloud Monitoring API to be enabled, and appropriate IAM roles to be configured. See the documentation for more details.',

    default: false,
  }),
  harmHateSpeech: defineString("HARM_CATEGORY_HATE_SPEECH", {
    label: "Hate Speech Threshold",
    description:
      "Threshold for hate speech content. Specify what probability level of hate speech content is blocked by the Gemini provider.",

    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select({
      Default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
      "Block low and above": "BLOCK_LOW_AND_ABOVE",
      "Block medium and above": "BLOCK_MEDIUM_AND_ABOVE",
      "Block only high": "BLOCK_ONLY_HIGH",
      "Block none": "BLOCK_NONE",
    }),
  }),
  harmDangerous: defineString("HARM_CATEGORY_DANGEROUS_CONTENT", {
    label: "Dangerous Content Threshold",
    description:
      "Threshold for dangerous content. Specify what probability level of dangerous content is blocked by the Gemini provider.",

    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select({
      Default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
      "Block low and above": "BLOCK_LOW_AND_ABOVE",
      "Block medium and above": "BLOCK_MEDIUM_AND_ABOVE",
      "Block only high": "BLOCK_ONLY_HIGH",
      "Block none": "BLOCK_NONE",
    }),
  }),
  harmHarassment: defineString("HARM_CATEGORY_HARASSMENT", {
    label: "Harassment Content Threshold",
    description:
      "Threshold for harassment content. Specify what probability level of harassment content is blocked by the Gemini provider.",

    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select({
      Default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
      "Block low and above": "BLOCK_LOW_AND_ABOVE",
      "Block medium and above": "BLOCK_MEDIUM_AND_ABOVE",
      "Block only high": "BLOCK_ONLY_HIGH",
      "Block none": "BLOCK_NONE",
    }),
  }),
  harmSexual: defineString("HARM_CATEGORY_SEXUALLY_EXPLICIT", {
    label: "Sexual Content Threshold",
    description:
      "Threshold for sexually explicit content. Specify what probability level of sexual content is blocked by the Gemini provider.",

    default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
    input: select({
      Default: "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
      "Block low and above": "BLOCK_LOW_AND_ABOVE",
      "Block medium and above": "BLOCK_MEDIUM_AND_ABOVE",
      "Block only high": "BLOCK_ONLY_HIGH",
      "Block none": "BLOCK_NONE",
    }),
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
    // extension.yaml sets `timeout: 540s`; without this the function takes
    // the 60s default and long generations time out.
    timeoutSeconds: 540,
  };
}

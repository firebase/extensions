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

import type { Expression } from "firebase-functions/params";

/** The type returned by `defineSecret` (not exported by name from the module). */
type SecretParam = ReturnType<
  typeof import("firebase-functions/params").defineSecret
>;

/** Generative AI provider backing the chatbot. */
export enum GenerativeAIProvider {
  GOOGLE_AI = "google-ai",
  VERTEX_AI = "vertex-ai",
}

/** A model safety setting (`{ category, threshold }`), accepted by both SDKs. */
export interface SafetySetting {
  category: string;
  threshold: string;
}

/**
 * Public configuration for chatbot handlers and deployable entry points.
 *
 * `model` and `projectId` are required; everything else has a sensible default.
 * This is a plain object, so several independent chatbots can be defined in one
 * functions codebase.
 */
export interface GenaiChatbotConfig {
  /** Generative AI provider. Defaults to `google-ai`. */
  provider?: GenerativeAIProvider | "google-ai" | "vertex-ai";
  /** API key for the `google-ai` provider. */
  apiKey?: string;
  /** Model id, e.g. `gemini-2.5-flash`. */
  model: string;
  /** Vertex AI model location. */
  vertexModelLocation?: string;
  /** GCP project id. */
  projectId: string;

  /** Watched messages collection (or collection group) path. */
  collectionName?: string;
  /** Field holding the user prompt. Defaults to `prompt`. */
  promptField?: string;
  /** Field the response is written to. Defaults to `response`. */
  responseField?: string;
  /** Field used to order conversation history. Defaults to `createTime`. */
  orderField?: string;
  /** Field the candidate list is written to. Defaults to `candidates`. */
  candidatesField?: string;

  /** Grounding/system context passed to the model first. */
  context?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Nucleus-sampling P. */
  topP?: number;
  /** Top-K sampling. */
  topK?: number;
  /** Number of candidates to request. Defaults to `1`. */
  candidateCount?: number;
  /** Max output tokens. */
  maxOutputTokens?: number;

  /** Allow per-discussion option overrides from the parent doc. Defaults to `false`. */
  enableOverrides?: boolean;
  /** Enable Genkit/Firebase telemetry. Defaults to `false`. */
  enableGenkitMonitoring?: boolean;
  /** Model safety settings. */
  safetySettings?: SafetySetting[];

  /** Secret params to bind on the function (e.g. the API key secret). */
  secrets?: SecretParam[];
}

/** {@link GenaiChatbotConfig} with all defaults applied. */
export interface ResolvedGenaiChatbotConfig {
  provider: GenerativeAIProvider;
  vertex: { model: string; modelLocation?: string };
  googleAi: { model: string; apiKey?: string };
  model: string;
  context?: string;
  projectId: string;
  collectionName: string;
  promptField: string;
  responseField: string;
  orderField: string;
  candidatesField: string;
  enableDiscussionOptionOverrides: boolean;
  enableGenkitMonitoring: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount: number;
  maxOutputTokens?: number;
  safetySettings: SafetySetting[];
  secrets?: SecretParam[];
}

/**
 * Deploy-time function options that must be present in the deploy manifest, so
 * each may be a literal or a Firebase param {@link Expression}.
 *
 * These shape the Firestore trigger and are read by the Firebase CLI during the
 * deploy discovery pass. They must never
 * be resolved with `.value()` at the module scope; pass the param objects through
 * so the SDK emits CEL expressions the CLI resolves after loading `.env` /
 * prompting. Resolving `document` eagerly would freeze its deploy-time default
 * into the manifest, silently deploying the wrong collection path.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
export interface DeployTimeOptions {
  /** Watched Firestore document/collection path for the trigger. */
  document: string | Expression<string>;
  /** Function timeout in seconds; extension.yaml sets `timeout: 540s`. */
  timeoutSeconds: number;
}

/**
 * Reads the current Firebase project id from the runtime-provided config.
 *
 * Firebase sets `FIREBASE_CONFIG` during deploy discovery, emulator runs, and
 * production runtime, so callers do not need to duplicate the project id in
 * extension config.
 */
export function getProjectId(): string {
  const config = process.env.FIREBASE_CONFIG;

  if (!config) {
    throw new Error("FIREBASE_CONFIG is not set");
  }

  return JSON.parse(config).projectId;
}

const DEFAULT_COLLECTION = "generate";

/**
 * Applies defaults to a {@link GenaiChatbotConfig}, producing the resolved shape
 * the handlers and generative clients consume.
 *
 * @param config - The user-supplied configuration.
 * @returns The configuration with every field populated.
 */
export function resolveConfig(
  config: GenaiChatbotConfig
): ResolvedGenaiChatbotConfig {
  const provider =
    (config.provider as GenerativeAIProvider) ?? GenerativeAIProvider.GOOGLE_AI;
  return {
    provider,
    vertex: {
      model: config.model,
      modelLocation: config.vertexModelLocation,
    },
    googleAi: {
      model: config.model,
      apiKey: config.apiKey,
    },
    model: config.model,
    context: config.context,
    projectId: config.projectId,
    collectionName: config.collectionName ?? DEFAULT_COLLECTION,
    promptField: config.promptField ?? "prompt",
    responseField: config.responseField ?? "response",
    orderField: config.orderField ?? "createTime",
    candidatesField: config.candidatesField ?? "candidates",
    enableDiscussionOptionOverrides: config.enableOverrides ?? false,
    enableGenkitMonitoring: config.enableGenkitMonitoring ?? false,
    temperature: config.temperature,
    topP: config.topP,
    topK: config.topK,
    candidateCount: config.candidateCount ?? 1,
    maxOutputTokens: config.maxOutputTokens,
    safetySettings: config.safetySettings ?? [],
    secrets: config.secrets,
  };
}

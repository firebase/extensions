/*
 * Copyright 2019 Google LLC
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

import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/firestore";
import { onCall } from "firebase-functions/https";
import { expr } from "firebase-functions/params";
import { onTaskDispatched } from "firebase-functions/tasks";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import {
  afterFirstDeploy,
  afterRedeploy,
} from "firebase-functions/v2/lifecycle";
import {
  CONFIG_EXPRESSIONS,
  configFromEnv,
  geminiApiKey,
  openAiApiKey,
} from "./config";
import * as events from "./events";
import {
  type ResolvedVectorSearchConfig,
  resolveVectorSearchConfig,
} from "./export-config";
import {
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
import * as logs from "./logs";

export * from "./lib";

const INIT_VECTOR_SEARCH_FUNCTION = "initVectorSearch";
const FUNCTION_TIMEOUT_SECONDS = 540;
const TASK_MAX_ATTEMPTS = 50;
const REQUIRED_ROLES = [
  "roles/datastore.user",
  "roles/aiplatform.user",
  "roles/storage.objectAdmin",
  "roles/datastore.indexAdmin",
] as const satisfies ReadonlyArray<Role>;
const REQUIRED_APIS = [
  {
    api: "aiplatform.googleapis.com",
    reason:
      "This extension uses Vertex AI for embedding and vector search when configured.",
  },
  {
    api: "storage-component.googleapis.com",
    reason: "Needed to read image data from Cloud Storage.",
  },
] as const;
const FUNCTION_SECRETS = [geminiApiKey, openAiApiKey];
const BASE_FUNCTION_OPTIONS = {
  region: CONFIG_EXPRESSIONS.region,
};
const DEFAULT_TASK_OPTIONS = {
  ...BASE_FUNCTION_OPTIONS,
  memory: "512MiB",
  timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
} as const;
const EMBEDDING_TASK_OPTIONS = {
  ...BASE_FUNCTION_OPTIONS,
  memory: "1GiB",
  timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
  retryConfig: { maxAttempts: TASK_MAX_ATTEMPTS },
} as const;
const FIRESTORE_FUNCTION_OPTIONS = {
  ...BASE_FUNCTION_OPTIONS,
  memory: "512MiB",
  timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
  secrets: FUNCTION_SECRETS,
} as const;
const CALLABLE_FUNCTION_OPTIONS = {
  ...BASE_FUNCTION_OPTIONS,
  memory: "512MiB",
  secrets: FUNCTION_SECRETS,
} as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

afterFirstDeploy({ task: { function: INIT_VECTOR_SEARCH_FUNCTION } });
afterRedeploy({ task: { function: INIT_VECTOR_SEARCH_FUNCTION } });

let resolvedConfig: ResolvedVectorSearchConfig | undefined;
let ctx: HandlerContext | undefined;

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function getConfig(): ResolvedVectorSearchConfig {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  resolvedConfig = resolveVectorSearchConfig(configFromEnv());
  logs.init(resolvedConfig);
  return resolvedConfig;
}

function getContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  ensureDefaultApp();

  events.setupEventChannel();

  ctx = {
    firestore: getFirestore(),
    config: getConfig(),
  };

  return ctx;
}

export const updateTrigger = onTaskDispatched(DEFAULT_TASK_OPTIONS, (request) =>
  handleUpdateTrigger(request, getContext())
);

export const updateTask = onTaskDispatched<VectorTaskData>(
  EMBEDDING_TASK_OPTIONS,
  (request) => handleUpdateTask(request, getContext())
);

export const backfillTrigger = onTaskDispatched(
  DEFAULT_TASK_OPTIONS,
  (request) => handleBackfillTrigger(request, getContext())
);

export const backfillTask = onTaskDispatched<VectorTaskData>(
  EMBEDDING_TASK_OPTIONS,
  (request) => handleBackfillTask(request, getContext())
);

export const embedOnWrite = onDocumentWritten(
  {
    ...FIRESTORE_FUNCTION_OPTIONS,
    document: CONFIG_EXPRESSIONS.collectionDocument,
  },
  (event) => handleEmbedOnWrite(event, getContext())
);

export const queryOnWrite = onDocumentWritten(
  {
    ...FIRESTORE_FUNCTION_OPTIONS,
    document: expr`${CONFIG_EXPRESSIONS.queryCollectionName}/{queryId}`,
  },
  (event) => handleQueryOnWrite(event, getContext())
);

export const queryCallable = onCall(CALLABLE_FUNCTION_OPTIONS, (request) =>
  handleQueryCall(request, getContext())
);

export const initVectorSearch = onTaskDispatched(
  {
    ...DEFAULT_TASK_OPTIONS,
    secrets: FUNCTION_SECRETS,
  },
  async () => {
    await handleInit(getContext());
  }
);

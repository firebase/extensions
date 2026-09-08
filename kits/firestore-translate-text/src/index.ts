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

import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CONFIG_EXPRESSIONS, configFromEnv, googleAiApiKey } from "./config";
import * as events from "./events";
import {
  type ResolvedTranslateConfig,
  resolveTranslateConfig,
} from "./export-config";
import { type HandlerContext, handleDocumentWrite } from "./handlers";
import * as logs from "./logs";
import { createTranslationService } from "./translate";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  // Gen2 Firestore triggers need Eventarc receive and run.invoker on the function SA.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
];
const REQUIRED_APIS = [
  {
    api: "firestore.googleapis.com",
    reason:
      "Reads source strings and writes translations back to Cloud Firestore.",
  },
  {
    api: "translate.googleapis.com",
    reason:
      "To use Google Translate to translate strings into the specified target languages.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

let resolvedConfig: ResolvedTranslateConfig | undefined;
let context: HandlerContext | undefined;

function getConfig(): ResolvedTranslateConfig {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  resolvedConfig = resolveTranslateConfig(configFromEnv());
  logs.init(resolvedConfig);
  return resolvedConfig;
}

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function getContext(): HandlerContext {
  if (context) {
    return context;
  }

  ensureDefaultApp();

  events.setupEventChannel();

  const resolved = getConfig();
  // The secret is only readable at runtime, so it joins the config here rather
  // than in resolveTranslateConfig.
  const config: ResolvedTranslateConfig = {
    ...resolved,
    googleAiApiKey: resolved.useGenkit
      ? googleAiApiKey.value()
      : resolved.googleAiApiKey,
  };
  context = {
    config,
    service: createTranslationService(config, getFirestore()),
  };

  return context;
}

export const fstranslate = onDocumentWritten(
  {
    document: CONFIG_EXPRESSIONS.document,
    secrets: [googleAiApiKey],
  },
  (event) => handleDocumentWrite(event, getContext())
);

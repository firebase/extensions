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

import { SpeechClient } from "@google-cloud/speech";
import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/storage";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { configFromEnv, envDeployOptions } from "./config";
import * as events from "./events";
import type { ResolvedSpeechToTextConfig } from "./export-config";
import { resolveConfig } from "./export-config";
import { type HandlerContext, handleObjectFinalized } from "./handlers";
import * as logs from "./logs";
import { transcribeFns } from "./transcribe-fns";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/storage.objectAdmin",
  "roles/datastore.user",
];
const REQUIRED_APIS = [
  {
    api: "speech.googleapis.com",
    reason: "Used for transcribing audio files with Cloud Speech-to-Text.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

const deploy = envDeployOptions();

let resolvedConfig: ResolvedSpeechToTextConfig | undefined;
let ctx: HandlerContext | undefined;

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function getConfig(): ResolvedSpeechToTextConfig {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  resolvedConfig = resolveConfig(configFromEnv());
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
    config: getConfig(),
    db: getFirestore(),
    client: new SpeechClient(),
    getBucket: (name: string) => getStorage().bucket(name),
    fns: transcribeFns,
    events,
  };

  return ctx;
}

export const transcribeAudio = onObjectFinalized(
  {
    bucket: deploy.bucket,
    region: deploy.region,
    timeoutSeconds: deploy.timeoutSeconds,
    memory: deploy.memory,
  },
  (event) => handleObjectFinalized(event, getContext())
);

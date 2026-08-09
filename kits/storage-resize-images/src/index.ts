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

import * as admin from "firebase-admin";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import sharp from "sharp";
import { configFromEnv } from "./config";
import * as events from "./events";
import { resolveResizeImagesConfig } from "./export-config";
import { type HandlerContext, handleObjectFinalized } from "./handlers";
import * as logs from "./logs";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/storage.admin",
  "roles/aiplatform.user",
  // Gen2 Storage triggers need Eventarc receive and run.invoker on the function SA.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
];
const REQUIRED_APIS = [
  {
    api: "storage-component.googleapis.com",
    reason: "Needed to use Cloud Storage.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

const resolved = resolveResizeImagesConfig(configFromEnv());

sharp.cache(false);
if (admin.apps.length === 0) {
  admin.initializeApp();
}

events.setupEventChannel();
logs.init(resolved);

const ctx: HandlerContext = {
  config: resolved,
  storage: admin.storage(),
};

export const generateResizedImage = onObjectFinalized(
  {
    bucket: resolved.bucket,
    region: resolved.region,
    memory: resolved.memory,
  },
  (event) => handleObjectFinalized(event, ctx)
);

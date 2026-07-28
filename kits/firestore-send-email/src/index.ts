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
import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import { configFromEnv, envDeployOptions, secretParams } from "./config";
import * as events from "./events";
import { resolveConfig } from "./export-config";
import { type HandlerContext, handleQueueDoc } from "./handlers";
import { transportLayer } from "./helpers";
import * as logs from "./logs";
import { Templates } from "./templates";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = ["roles/datastore.user"];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

const deploy = envDeployOptions();
const secrets = secretParams;

let initialization: Promise<HandlerContext> | null = null;

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function ensureInitialized(): Promise<HandlerContext> {
  if (!initialization) {
    initialization = (async () => {
      ensureDefaultApp();

      const resolved = resolveConfig(configFromEnv());
      logs.init(resolved);

      const db = getFirestore(resolved.databaseId);
      const transport = await transportLayer(resolved);
      const templates = resolved.templatesCollection
        ? new Templates(db.collection(resolved.templatesCollection))
        : undefined;

      events.setupEventChannel();

      return { db, transport, templates, config: resolved };
    })().catch((err) => {
      initialization = null;
      throw err;
    });
  }

  return initialization;
}

export const processQueue = onDocumentWritten(
  {
    region: deploy.region,
    document: deploy.document,
    database: deploy.database,
    timeoutSeconds: 120,
    secrets: secrets as any,
  },
  async (event) => handleQueueDoc(event, await ensureInitialized())
);

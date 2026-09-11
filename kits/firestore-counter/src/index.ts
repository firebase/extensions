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
import { expr } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/scheduler";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import * as events from "./events";
import { resolveCounterConfig } from "./export-config";
import {
  type HandlerContext,
  handleSchedule,
  handleShardWrite,
  handleWorker,
} from "./handlers";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  "roles/cloudscheduler.admin",
  // Gen2 Firestore triggers need Eventarc receive and run.invoker on the function SA.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
];
const REQUIRED_APIS = [
  {
    api: "firestore.googleapis.com",
    reason: "Reads and writes counter shards in Cloud Firestore.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

let ctx: HandlerContext | undefined;

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function getHandlerContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  const config = resolveCounterConfig(configFromEnv());

  ensureDefaultApp();

  events.setupEventChannel();

  const firestore = getFirestore();

  ctx = {
    firestore,
    config,
  };

  return ctx;
}

export const controllerCore = onSchedule(
  {
    schedule: CONFIG_EXPRESSIONS.schedule as unknown as string,
    maxInstances: 1,
  },
  (event) => handleSchedule(event, getHandlerContext())
);

export const onWrite = onDocumentWritten(
  {
    document: "{collection}/{counter=**}/_counter_shards_/{shardId}",
    maxInstances: 1,
    timeoutSeconds: 120,
  },
  (event) => handleShardWrite(event, getHandlerContext())
);

export const worker = onDocumentWritten(
  {
    document: expr`${CONFIG_EXPRESSIONS.internalStatePath}/workers/{workerId}`,
  },
  handleWorker
);

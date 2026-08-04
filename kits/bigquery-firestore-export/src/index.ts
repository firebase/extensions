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

/**
 * Main entry point. Exports the wired functions with deploy-time param
 * expressions, then resolves concrete config lazily at runtime. Re-export
 * `processMessages` and `upsertTransferConfig` from your own functions codebase
 * entry; configuration comes from a `.env` (or `.env.<projectId>`), which the
 * Firebase CLI loads at deploy.
 *
 * Because this module initializes runtime dependencies lazily, deploy discovery
 * can analyze it without resolving params too early. For side-effect-free
 * imports (the handlers and config types), import from `./lib` instead.
 */

import { BigQuery } from "@google-cloud/bigquery";
import { v1 as dtsV1 } from "@google-cloud/bigquery-data-transfer";
import { PubSub } from "@google-cloud/pubsub";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onMessagePublished } from "firebase-functions/pubsub";
import { onTaskDispatched } from "firebase-functions/tasks";
import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import {
  afterFirstDeploy,
  afterRedeploy,
} from "firebase-functions/v2/lifecycle";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import { resolveExportConfig } from "./export-config";
import type { HandlerContext } from "./handlers";
import { handleProcessMessage, handleUpsertTransferConfig } from "./handlers";
import * as logs from "./logs";

// Re-export the side-effect-free library surface (handlers and config types).
export * from "./lib";

const UPSERT_TRANSFER_CONFIG_FUNCTION = "upsertTransferConfig";
const LIFECYCLE_RETRY_CONFIG = {
  maxAttempts: 15,
  minBackoffSeconds: 60,
} as const;
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  "roles/bigquery.admin",
  "roles/pubsub.admin",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

// The extension ran upsertTransferConfig on install, update, and configure;
// afterFirstDeploy + afterRedeploy reproduce all three (the reconcile is
// idempotent).
afterFirstDeploy({ task: { function: UPSERT_TRANSFER_CONFIG_FUNCTION } });
afterRedeploy({ task: { function: UPSERT_TRANSFER_CONFIG_FUNCTION } });

let ctx: HandlerContext | undefined;

function getHandlerContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  const config = resolveExportConfig(configFromEnv());

  logs.setLogLevel(config.logLevel);
  logs.init(config);

  if (getApps().length === 0) {
    initializeApp();
  }

  ctx = {
    db: getFirestore(),
    config,
    dts: new dtsV1.DataTransferServiceClient({ projectId: config.projectId }),
    bigquery: new BigQuery(),
    pubsub: new PubSub({ projectId: config.projectId }),
  };

  return ctx;
}

const functionOptions = {
  region: CONFIG_EXPRESSIONS.location,
};

/**
 * Pub/Sub trigger: receives BigQuery Data Transfer Service run-completion
 * notifications and copies successful runs' result tables into Firestore.
 */
export const processMessages = onMessagePublished(
  {
    ...functionOptions,
    topic: CONFIG_EXPRESSIONS.pubsubTopic,
  },
  (event) => handleProcessMessage(event, getHandlerContext())
);

/**
 * Provisioning lifecycle task, as in the extension. Ensures the notification
 * Pub/Sub topic exists and reconciles the DTS scheduled query (create or
 * diff-update), mirroring the result into Firestore. Runs in the function's own
 * identity, so the created transfer config runs as the managed runtime service
 * account. Enqueued automatically after first deploy and after redeploys;
 * Cloud Tasks retries a failed reconcile on its own schedule. Idempotent.
 */
export const upsertTransferConfig = onTaskDispatched(
  {
    ...functionOptions,
    memory: "1GiB",
    retryConfig: LIFECYCLE_RETRY_CONFIG,
  },
  () => handleUpsertTransferConfig(getHandlerContext())
);

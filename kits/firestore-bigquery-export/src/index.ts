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
 * `fsexportbigquery` and `initBigQuerySync` from your own functions codebase
 * entry; configuration comes from a `.env` (or
 * `.env.<projectId>`), which the Firebase CLI loads at deploy.
 *
 * Because this module initializes runtime dependencies lazily, deploy discovery
 * can analyze it without resolving params too early.
 * For side-effect-free imports (the handlers and config types), import from
 * `./lib` instead.
 */

import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentWritten } from "firebase-functions/firestore";
import { expr } from "firebase-functions/params";
import { onTaskDispatched } from "firebase-functions/tasks";
import type { Role } from "firebase-functions/v2";
import {
  afterFirstDeploy,
  afterRedeploy,
  requiresRole,
} from "firebase-functions/v2";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import * as events from "./events";
import { resolveExportConfig, toTrackerConfig } from "./export-config";
import { type HandlerContext, handleDocumentWrite } from "./handlers";
import { createEnsureInitialized } from "./init";
import * as logs from "./logs";

// Re-export the side-effect-free library surface (handlers and config types).
export * from "./lib";

const INIT_BIGQUERY_SYNC_FUNCTION = "initBigQuerySync";
const SETUP_BIGQUERY_SYNC_FUNCTION = "setupBigQuerySync";
const LIFECYCLE_RETRY_CONFIG = {
  maxAttempts: 15,
  minBackoffSeconds: 60,
} as const;
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/bigquery.dataEditor",
  "roles/datastore.user",
  "roles/bigquery.user",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

afterFirstDeploy({ task: { function: INIT_BIGQUERY_SYNC_FUNCTION } });
afterRedeploy({ task: { function: SETUP_BIGQUERY_SYNC_FUNCTION } });

let ctx: HandlerContext | undefined;

function getHandlerContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  const config = resolveExportConfig(configFromEnv());
  const tracker = new FirestoreBigQueryEventHistoryTracker(
    toTrackerConfig(config)
  );

  logs.logger.setLogLevel(config.logLevel);
  logs.init(config);

  if (getApps().length === 0) {
    initializeApp();
  }

  events.setupEventChannel();

  const ensureInitialized = createEnsureInitialized(tracker);

  ctx = {
    tracker,
    config,
    ensureInitialized,
  };

  return ctx;
}

const functionOptions = {
  region: CONFIG_EXPRESSIONS.location,
  serviceAccount: CONFIG_EXPRESSIONS.serviceAccount,
};

/**
 * Firestore trigger: streams document writes on the watched collection into the
 * BigQuery changelog table. Failed executions are retried by the Firebase
 * Functions runtime.
 */
export const fsexportbigquery = onDocumentWritten(
  {
    ...functionOptions,
    document: expr`${CONFIG_EXPRESSIONS.collectionPath}/{documentId}`,
    database: CONFIG_EXPRESSIONS.database,
    retry: true,
  },
  (event) => handleDocumentWrite(event, getHandlerContext())
);

async function handleBigQuerySyncInitialization(): Promise<void> {
  try {
    await getHandlerContext().ensureInitialized();
  } catch (err) {
    logs.error(false, "Failed to initialize BigQuery resources", err);
    throw err;
  }
}

/**
 * Provisioning lifecycle task, as in the extension. Runs in the function's own
 * identity, so it has the runtime service account and bound secrets that
 * creating the dataset/table/views needs (e.g. CMEK). Enqueue it once after
 * deploy; Cloud Tasks retries a failed initialization on its own schedule, so a
 * transient BigQuery error does not leave the resources unprovisioned. It is
 * idempotent (initialize() no-ops when resources already exist) and can also be
 * invoked directly as an authenticated HTTP POST, without queue retries.
 */
export const initBigQuerySync = onTaskDispatched(
  {
    ...functionOptions,
    retryConfig: LIFECYCLE_RETRY_CONFIG,
  },
  handleBigQuerySyncInitialization
);

/**
 * Update/configure lifecycle task. Uses the same idempotent provisioning path
 * so BigQuery resources are reconciled after parameter changes.
 */
export const setupBigQuerySync = onTaskDispatched(
  {
    ...functionOptions,
    retryConfig: LIFECYCLE_RETRY_CONFIG,
  },
  handleBigQuerySyncInitialization
);

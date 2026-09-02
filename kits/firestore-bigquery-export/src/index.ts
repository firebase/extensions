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
 * `fsexportbigquery`, `syncBigQuery`, and `initBigQuerySync` from your own
 * functions codebase entry; configuration comes from a `.env` (or
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
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import {
  afterFirstDeploy,
  afterRedeploy,
} from "firebase-functions/v2/lifecycle";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import * as events from "./events";
import { resolveExportConfig, toTrackerConfig } from "./export-config";
import {
  type HandlerContext,
  type SerializedDocumentChange,
  handleDocumentWrite,
  handleSyncBigQueryTask,
} from "./handlers";
import { createEnsureInitialized } from "./init";
import * as logs from "./logs";
import { firestoreLocationToFunctionRegion } from "./region";
import { enqueueSyncTask } from "./tasks";

// Re-export the side-effect-free library surface (handlers and config types).
export * from "./lib";

const INIT_BIGQUERY_SYNC_FUNCTION = "initBigQuerySync";
const SETUP_BIGQUERY_SYNC_FUNCTION = "setupBigQuerySync";
const LIFECYCLE_RETRY_CONFIG = {
  maxAttempts: 15,
  minBackoffSeconds: 60,
} as const;
const SYNC_RETRY_CONFIG = {
  maxAttempts: 5,
  minBackoffSeconds: 60,
} as const;
const SYNC_MAX_CONCURRENT_DISPATCHES = 500;
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/bigquery.dataEditor",
  "roles/datastore.user",
  "roles/bigquery.user",
  // Gen2 Firestore triggers need Eventarc receive and run.invoker on the function SA.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
  // The trigger enqueues failed writes onto its own syncBigQuery task queue.
  "roles/cloudtasks.enqueuer",
];
const REQUIRED_APIS = [
  {
    api: "bigquery.googleapis.com",
    reason: "Mirrors data from your Cloud Firestore collection in BigQuery.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

afterFirstDeploy({
  task: { function: INIT_BIGQUERY_SYNC_FUNCTION, body: { data: {} } },
});
afterRedeploy({
  task: { function: SETUP_BIGQUERY_SYNC_FUNCTION, body: { data: {} } },
});

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
    enqueue: (change: SerializedDocumentChange) =>
      enqueueSyncTask(change, config.maxEnqueueAttempts),
  };

  return ctx;
}

/*
 * Read at module load: the CLI populates `.env` values into the discovery
 * process env (firebase-tools >= 15.28.0), and the region option cannot be a
 * param expression. When unset, no function declares a region and the CLI
 * falls back to its default. The Eventarc trigger region needs no handling:
 * the CLI pins it to the database's own region regardless of where the
 * function runs.
 */
const functionRegion = firestoreLocationToFunctionRegion(
  process.env.DATABASE_REGION
);

/**
 * Firestore trigger: streams document writes on the watched collection into the
 * BigQuery changelog table. A failed inline write buffers through the
 * `syncBigQuery` queue and the execution still succeeds; `retry: true` stays on
 * so an event whose enqueue ALSO failed (rethrown by the handler) is
 * redelivered instead of dropped.
 */
export const fsexportbigquery = onDocumentWritten(
  {
    ...(functionRegion ? { region: functionRegion } : {}),
    document: expr`${CONFIG_EXPRESSIONS.collectionPath}/{documentId}`,
    database: CONFIG_EXPRESSIONS.database,
    retry: true,
  },
  (event) => handleDocumentWrite(event, getHandlerContext())
);

/**
 * Write-buffer task queue: re-attempts writes that failed inline, on Cloud
 * Tasks' schedule (5 attempts, 60s minimum backoff, dispatch-throttled by
 * `MAX_DISPATCHES_PER_SECOND`). After the last attempt the task is dropped;
 * by then the tracker has written the row to `BACKUP_COLLECTION` on every
 * terminal insert failure, when that collection is configured.
 */
export const syncBigQuery = onTaskDispatched<SerializedDocumentChange>(
  {
    ...(functionRegion ? { region: functionRegion } : {}),
    retryConfig: SYNC_RETRY_CONFIG,
    rateLimits: {
      maxConcurrentDispatches: SYNC_MAX_CONCURRENT_DISPATCHES,
      maxDispatchesPerSecond: CONFIG_EXPRESSIONS.maxDispatchesPerSecond,
    },
  },
  (req) => handleSyncBigQueryTask(req, getHandlerContext())
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
 * First-deploy provisioning task (`afterFirstDeploy`). Runs in the function's
 * own identity, so it has the runtime service account and bound secrets that
 * creating the dataset/table/views needs (e.g. CMEK). Cloud Tasks retries a
 * failed initialization on its own schedule, so a transient BigQuery error does
 * not leave the resources unprovisioned. It is idempotent (`initialize()`
 * no-ops when resources already exist) and can also be invoked directly as an
 * authenticated HTTP POST, without queue retries.
 */
export const initBigQuerySync = onTaskDispatched(
  {
    ...(functionRegion ? { region: functionRegion } : {}),
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
    ...(functionRegion ? { region: functionRegion } : {}),
    retryConfig: LIFECYCLE_RETRY_CONFIG,
  },
  handleBigQuerySyncInitialization
);

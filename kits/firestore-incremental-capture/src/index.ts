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

/**
 * Main entry point. Exports the wired functions with deploy-time param
 * expressions, then resolves concrete config lazily at runtime. Re-export these
 * from your own functions codebase entry; configuration comes from a `.env`
 * (or `.env.<projectId>`), which the Firebase CLI loads at deploy.
 *
 * Because this module initializes runtime dependencies lazily, deploy discovery
 * can analyze it without resolving params too early.
 *
 * For side-effect-free imports (the handlers, config and wire-format types),
 * import from `./lib` instead.
 *
 * Restoration additionally depends on out-of-band setup - a PITR-enabled source
 * database, an existing backup database, and a staged Dataflow flex template.
 * See `scripts/setup.sh` and the README.
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentWritten } from "firebase-functions/firestore";
import { onRequest } from "firebase-functions/https";
import { expr } from "firebase-functions/params";
import { onTaskDispatched } from "firebase-functions/tasks";
// Imported from the narrow subpath, not the `firebase-functions/v2` barrel: the
// barrel pulls in the RTDB provider, whose firebase-admin dependency fails to
// load without @firebase/app installed.
import type { Role } from "firebase-functions/v2/options";
import { requiresRole } from "firebase-functions/v2/options";
import {
  afterFirstDeploy,
  afterRedeploy,
} from "firebase-functions/v2/lifecycle";
import { ChangelogTable } from "./bigquery";
import { resolveCaptureConfig } from "./capture-config";
import type { ChangelogRow } from "./changelog";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import { RestorationLauncher } from "./dataflow";
import {
  handleChangelogTask,
  handleDocumentWrite,
  handleRestorationRequest,
  handleRestorationTask,
  type HandlerContext,
  type RestorationRequest,
} from "./handlers";
import * as logs from "./logs";
import {
  CHANGELOG_TASK_FUNCTION,
  enqueue,
  RESTORATION_TASK_FUNCTION,
} from "./tasks";

// Re-export the side-effect-free library surface.
export * from "./lib";

const INIT_FUNCTION = "initIncrementalCapture";
const LIFECYCLE_RETRY_CONFIG = {
  maxAttempts: 15,
  minBackoffSeconds: 60,
} as const;
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/bigquery.dataEditor",
  "roles/bigquery.user",
  "roles/datastore.user",
  "roles/dataflow.developer",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

afterFirstDeploy({ task: { function: INIT_FUNCTION } });
afterRedeploy({ task: { function: INIT_FUNCTION } });

let ctx: HandlerContext | undefined;

function getHandlerContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  const config = resolveCaptureConfig(configFromEnv());

  logs.setLogLevel(config.logLevel);

  if (getApps().length === 0) {
    initializeApp();
  }

  const changelog = new ChangelogTable(config);
  const launcher = new RestorationLauncher(config);

  ctx = {
    config,
    enqueueChangelogRow: (row) =>
      enqueue(config, CHANGELOG_TASK_FUNCTION, row as unknown as object),
    insertChangelogRows: (rows) => changelog.insert(rows),
    enqueueRestoration: (request) =>
      enqueue(config, RESTORATION_TASK_FUNCTION, request),
    launchRestorationJob: (request) => launcher.launch(request),
  };

  return ctx;
}

const functionOptions = {
  region: CONFIG_EXPRESSIONS.location,
};

/**
 * Firestore trigger: serializes each document write on the watched collection
 * and queues it for insertion into the BigQuery changelog. Failed executions
 * are retried by the Firebase Functions runtime, because a dropped write is a
 * permanent hole in the changelog.
 */
export const syncData = onDocumentWritten(
  {
    ...functionOptions,
    document: expr`${CONFIG_EXPRESSIONS.syncCollectionPath}/{documentId}`,
    database: CONFIG_EXPRESSIONS.database,
    retry: true,
  },
  (event) => handleDocumentWrite(event, getHandlerContext())
);

/**
 * Inserts a queued changelog row into BigQuery. Separated from the trigger so a
 * BigQuery outage retries on the queue's schedule.
 */
export const syncChangelogTask = onTaskDispatched<ChangelogRow>(
  {
    ...functionOptions,
    retryConfig: { maxAttempts: 15, minBackoffSeconds: 10 },
  },
  (request) => handleChangelogTask(request.data, getHandlerContext())
);

/**
 * Starts a restoration of the backup database to a point in time.
 *
 * SECURITY: this endpoint is intentionally unauthenticated, matching the
 * firestore-incremental-capture extension it was migrated from. Anyone who can
 * reach the URL can trigger a Dataflow job that batch-writes over the backup
 * database. Restrict it before deploying to production - with Cloud Run ingress
 * settings, an IAM invoker policy, or by fronting it with your own authorized
 * endpoint that enqueues `runRestorationTask` directly.
 */
export const onHttpRunRestoration = onRequest(
  functionOptions,
  async (request, response) => {
    const result = await handleRestorationRequest(
      request.body,
      getHandlerContext()
    );
    response.status(result.status).send(result.body);
  }
);

/**
 * Runs a queued restoration by launching the Dataflow pipeline. The job itself
 * runs asynchronously in Dataflow; this only starts it.
 */
export const runRestorationTask = onTaskDispatched<RestorationRequest>(
  {
    ...functionOptions,
    memory: "1GiB",
  },
  async (request) => {
    await handleRestorationTask(request.data, getHandlerContext());
  }
);

/**
 * Provisioning lifecycle task. Creates the BigQuery dataset and changelog table
 * if they are missing, running in the function's own identity so it has the
 * runtime service account the creation needs. Enqueued after first deploy and
 * after each redeploy; idempotent, and retried by Cloud Tasks on a transient
 * BigQuery error so a blip does not leave the changelog unprovisioned.
 *
 * It does not provision the restoration prerequisites - PITR, the backup
 * database and the Dataflow flex template all need gcloud, which is not
 * available in the functions runtime. Run `scripts/setup.sh` for those.
 */
export const initIncrementalCapture = onTaskDispatched(
  {
    ...functionOptions,
    retryConfig: LIFECYCLE_RETRY_CONFIG,
  },
  async () => {
    const { config } = getHandlerContext();

    try {
      await new ChangelogTable(config).initialize();
    } catch (err) {
      logs.error("Failed to initialize BigQuery changelog resources", err);
      throw err;
    }
  }
);

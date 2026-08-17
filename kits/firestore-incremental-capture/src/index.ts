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
import { getStorage } from "firebase-admin/storage";
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
// Granted by the Firebase CLI to the managed runtime service account it creates
// for this codebase. The setup script cannot grant these: the account does not
// exist until the first deploy, and declarative security rules out supplying a
// runtime service account of your own.
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/bigquery.dataEditor",
  "roles/bigquery.user",
  "roles/datastore.user",
  "roles/dataflow.developer",
  // Gen2 event triggers need Eventarc receive and run.invoker on the function
  // SA; task queue pushes and lifecycle hooks authenticate as it too.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
  // syncData and onHttpRunRestoration enqueue onto this kit's own task queues.
  "roles/cloudtasks.enqueuer",
  // Launching a flex template acts as the Dataflow worker service account.
  // Without this, every restoration fails with iam.serviceAccounts.actAs denied.
  "roles/iam.serviceAccountUser",
  // Reads the staged flex template spec from Cloud Storage.
  "roles/storage.objectViewer",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

// The empty data envelope is required: the CLI enqueues the hook body
// verbatim, and the tasks handler rejects a request without a `data` key.
afterFirstDeploy({ task: { function: INIT_FUNCTION, body: { data: {} } } });
afterRedeploy({ task: { function: INIT_FUNCTION, body: { data: {} } } });

/**
 * The project's default Cloud Storage bucket, or `undefined` if it has none.
 *
 * Read from the initialized app rather than assembled from the project id: the
 * default bucket is `<projectId>.firebasestorage.app` for projects created after
 * September 2024 and `<projectId>.appspot.com` for older ones.
 *
 * Swallows the lookup failure because only restoration needs a bucket. A project
 * that never enabled Storage has none, and letting this throw would take the
 * capture path down with it - `getHandlerContext` is shared by every function.
 */
function defaultBucketName(): string | undefined {
  try {
    return getStorage().bucket().name;
  } catch {
    return undefined;
  }
}

let ctx: HandlerContext | undefined;

function getHandlerContext(): HandlerContext {
  if (ctx) {
    return ctx;
  }

  // Checked by name, not by count: firebase-functions registers its own
  // "__FIREBASE_FUNCTIONS_SDK__" app before event handlers run, so a non-empty
  // list does not imply the default app the admin SDK entry points need.
  if (!getApps().some((app) => app.name === "[DEFAULT]")) {
    initializeApp();
  }

  const config = resolveCaptureConfig(configFromEnv(defaultBucketName()));

  logs.setLogLevel(config.logLevel);

  const changelog = new ChangelogTable(config);

  // Constructed on first use: it loads gRPC protos, and the capture path - which
  // is every invocation except a restoration - never touches Dataflow.
  let launcher: RestorationLauncher | undefined;

  ctx = {
    config,
    enqueueChangelogRow: (row) =>
      enqueue(config, CHANGELOG_TASK_FUNCTION, row as unknown as object),
    insertChangelogRows: (rows) => changelog.insert(rows),
    enqueueRestoration: (request) =>
      enqueue(config, RESTORATION_TASK_FUNCTION, request),
    launchRestorationJob: (request) => {
      launcher ??= new RestorationLauncher(config);
      return launcher.launch(request);
    },
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
    // Matches the extension's allowance for this function; the v2 defaults
    // (256MiB/60s) would be a silent downgrade.
    memory: "512MiB",
    timeoutSeconds: 540,
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
    // As the extension's runInitialSetup: creating a dataset and table can be
    // slow, and the v2 default 60s timeout would cut it short.
    memory: "512MiB",
    timeoutSeconds: 540,
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

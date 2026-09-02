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
 * Main entry point. Exports the wired Pub/Sub and lifecycle task functions,
 * while resolving concrete config and clients lazily at runtime. Import from
 * `./lib` for the side-effect-free handlers, helpers, and config types.
 */

import { BigQuery } from "@google-cloud/bigquery";
import { v1 as bigqueryDataTransfer } from "@google-cloud/bigquery-data-transfer";
import { PubSub } from "@google-cloud/pubsub";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import {
  afterFirstDeploy,
  afterRedeploy,
} from "firebase-functions/v2/lifecycle";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
import type { ResolvedBigqueryFirestoreExportConfig } from "./export-config";
import { resolveConfig } from "./export-config";
import {
  type HandlerContext,
  handleMessagePublished,
  handleUpsertTransferConfig,
} from "./handlers";
import * as logs from "./logs";
import type { TransferRunPayload } from "./types";

export * from "./lib";

const UPSERT_FUNCTION = "upsertTransferConfig";
const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  "roles/bigquery.admin",
  "roles/pubsub.admin",
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
];
const REQUIRED_APIS = [
  {
    api: "bigquery.googleapis.com",
    reason: "Runs scheduled queries and reads their destination tables.",
  },
  {
    api: "bigquerydatatransfer.googleapis.com",
    reason: "Creates and reconciles the scheduled-query transfer config.",
  },
  {
    api: "pubsub.googleapis.com",
    reason: "Delivers BigQuery transfer-completion notifications.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

afterFirstDeploy({
  task: { function: UPSERT_FUNCTION, body: { data: {} } },
});
afterRedeploy({
  task: { function: UPSERT_FUNCTION, body: { data: {} } },
});

let ctx: HandlerContext | undefined;

function getContext(): HandlerContext {
  if (ctx) return ctx;

  const config: ResolvedBigqueryFirestoreExportConfig = resolveConfig(
    configFromEnv()
  );
  if (getApps().length === 0) initializeApp({ projectId: config.projectId });
  logs.init(config);

  ctx = {
    db: getFirestore(),
    bigquery: new BigQuery({ projectId: config.projectId }),
    dataTransfer: new bigqueryDataTransfer.DataTransferServiceClient({
      projectId: config.projectId,
    }),
    pubsub: new PubSub({ projectId: config.projectId }),
    config,
  };
  return ctx;
}

/** Consumes BigQuery Data Transfer completion notifications. */
export const processMessages = onMessagePublished<TransferRunPayload>(
  {
    topic: CONFIG_EXPRESSIONS.pubSubTopic,
    retry: false,
  },
  (event) => handleMessagePublished(event, getContext())
);

/** Creates, links, or reconciles this deployment's scheduled query. */
export const upsertTransferConfig = onTaskDispatched(
  {
    memory: "1GiB",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 30 },
  },
  () => handleUpsertTransferConfig(getContext)
);

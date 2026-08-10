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

import { PubSub } from "@google-cloud/pubsub";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { configFromEnv } from "./config";
import * as events from "./events";
import { getDatabaseUrl, resolveDeleteUserDataConfig } from "./export-config";
import {
  type HandlerContext,
  handleClear,
  handleDeletion as runDeletion,
  handleSearch as runSearch,
} from "./handlers";
import * as logs from "./logs";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.owner",
  "roles/firebasedatabase.admin",
  "roles/storage.admin",
  "roles/pubsub.admin",
  // Gen2 event triggers need Eventarc receive and run.invoker on the function SA.
  "roles/eventarc.eventReceiver",
  "roles/run.invoker",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

const resolved = resolveDeleteUserDataConfig(configFromEnv());
const databaseURL = getDatabaseUrl(
  resolved.rtdbInstance,
  resolved.rtdbLocation
);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    ...(databaseURL ? { databaseURL } : {}),
  });
}

events.setupEventChannel();
logs.init(resolved);

const ctx: HandlerContext = {
  firestore: getFirestore(resolved.firestoreDatabaseId),
  storage: admin.storage(),
  database: admin.database(),
  pubsub: new PubSub({ projectId: resolved.projectId }),
  config: resolved,
};

export const clearData = functionsV1.auth.user().onDelete((user) => {
  return handleClear(user.uid, ctx);
});

export const handleSearch = onMessagePublished(
  {
    topic: resolved.discoveryTopicName,
  },
  (event) => runSearch(event.data.message.json, ctx)
);

export const handleDeletion = onMessagePublished(
  {
    topic: resolved.deletionTopicName,
  },
  (event) => runDeletion(event.data.message.json, ctx)
);

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
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { onUserDeleted } from "firebase-functions/v2/identity";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { CONFIG_EXPRESSIONS, configFromEnv } from "./config";
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
const REQUIRED_APIS = [
  {
    api: "firestore.googleapis.com",
    reason: "Deletes user data from Cloud Firestore.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

let ctx: HandlerContext | undefined;

function getContext(): HandlerContext {
  if (ctx) {
    return ctx;
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

  ctx = {
    firestore: getFirestore(resolved.firestoreDatabaseId),
    storage: admin.storage(),
    // Resolved on first use. Without a configured RTDB instance there is no
    // databaseURL to initialize the app with, and admin.database() throws.
    get database() {
      return admin.database();
    },
    pubsub: new PubSub({ projectId: resolved.projectId }),
    config: resolved,
  };
  return ctx;
}

export const clearData = onUserDeleted((event) => {
  // The Auth event delivers no user record when the payload envelope is empty,
  // so bail before getContext() rather than initialising the SDKs for nothing.
  const uid = event.data?.uid;
  if (!uid) {
    logs.deletionEventMissingUid(event.id);
    return;
  }
  return handleClear(uid, getContext());
});

export const handleSearch = onMessagePublished(
  {
    topic: CONFIG_EXPRESSIONS.discoveryTopicName,
  },
  (event) => runSearch(event.data.message.json, getContext())
);

export const handleDeletion = onMessagePublished(
  {
    topic: CONFIG_EXPRESSIONS.deletionTopicName,
  },
  (event) => runDeletion(event.data.message.json, getContext())
);

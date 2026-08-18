/**
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

import { PubSub } from "@google-cloud/pubsub";
import * as admin from "firebase-admin";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-test";

export const PROJECT_ID = "demo-test";

export function initialize(): {
  db: Firestore;
  auth: admin.auth.Auth;
} {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return { db: admin.firestore(), auth: admin.auth() };
}

/** Publisher context matching the params in tests/emulator/app/.env. */
export function publisherContext(config: {
  instanceId: string;
  discoveryTopicName: string;
  deletionTopicName: string;
  searchDepth: number;
  searchFields: string;
}) {
  return {
    pubsub: new PubSub({ projectId: PROJECT_ID }),
    config,
  };
}

export const randomId = (): string =>
  `t${Math.random().toString(36).slice(2, 12)}`;

export const createUser = (auth: admin.auth.Auth) =>
  auth.createUser({ email: `${randomId()}@example.com` });

/** Polls until the predicate holds, so a slow trigger does not flake. */
export async function waitFor(
  predicate: () => Promise<boolean>,
  timeout = 45_000
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export const documentGone = (ref: DocumentReference) => async () =>
  !(await ref.get()).exists;

export const collectionEmpty =
  (db: Firestore, path: string) => async (): Promise<boolean> =>
    (await db.collection(path).get()).empty;

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

import type { Firestore } from "firebase-admin/firestore";
import type * as admin from "firebase-admin";
import { beforeAll, describe, expect, test } from "vitest";

import { resolveDeleteUserDataConfig } from "../../src/export-config";
import {
  publishSearch,
  runBatchPubSubDeletions,
} from "../../src/runBatchPubSubDeletions";
import { search } from "../../src/search";
import {
  collectionEmpty,
  createUser,
  documentGone,
  initialize,
  publisherContext,
  randomId,
  waitFor,
} from "./helpers";

// Matches tests/emulator/app/.env, which is what the deployed functions read.
const config = resolveDeleteUserDataConfig({
  instanceId: "demo",
  projectId: "demo-test",
  discoveryTopicName: "kit-demo-discovery",
  deletionTopicName: "kit-demo-deletion",
  searchDepth: 3,
  searchFields: "id,uid,userId",
});

let db: Firestore;
let auth: admin.auth.Auth;
let ctx: ReturnType<typeof publisherContext>;

beforeAll(() => {
  ({ db, auth } = initialize());
  ctx = publisherContext(config);
});

/**
 * Scopes discovery to one root collection. `search` publishes the same
 * message for every root collection, which in a shared emulator means every
 * collection left behind by another test.
 */
const discover = (uid: string, path: string) =>
  publishSearch(uid, 1, path, ctx);

describe("auto discovery", () => {
  test("deletes a top level collection named after the uid", async () => {
    const uid = randomId();
    await db.collection(uid).add({ foo: "bar" });

    await search(uid, 1, db, ctx);

    expect(await waitFor(collectionEmpty(db, uid))).toBe(true);
  });

  test("deletes a document named after the uid", async () => {
    const uid = randomId();
    const root = randomId();
    const doc = db.collection(root).doc(uid);
    await doc.set({ foo: "bar" });

    await discover(uid, root);

    expect(await waitFor(documentGone(doc))).toBe(true);
  });

  test("deletes a document whose search field holds the uid", async () => {
    const uid = randomId();
    const root = randomId();
    const doc = await db.collection(root).add({ uid });

    await discover(uid, root);

    expect(await waitFor(documentGone(doc))).toBe(true);
  });

  test("deletes a subcollection named after the uid", async () => {
    const uid = randomId();
    const root = randomId();
    const subcollection = db.collection(root).doc("parent").collection(uid);
    await subcollection.add({ foo: "bar" });

    await discover(uid, root);

    expect(await waitFor(collectionEmpty(db, subcollection.path))).toBe(true);
  });

  test("handles a document with no fields", async () => {
    const uid = randomId();
    const root = randomId();
    const doc = await db.collection(root).add({});

    await discover(uid, root);

    // Nothing matches, so the document survives and nothing throws.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    expect((await doc.get()).exists).toBe(true);
  });

  test("does not delete documents that match nothing", async () => {
    const uid = randomId();
    const root = randomId();
    const doc = await db.collection(root).add({ uid: "someone-else" });

    await discover(uid, root);

    await new Promise((resolve) => setTimeout(resolve, 5000));
    expect((await doc.get()).exists).toBe(true);
  });

  test("does not search past the configured depth", async () => {
    const uid = randomId();
    const root = randomId();
    const deep = db
      .collection(root)
      .doc("1")
      .collection("2")
      .doc("2")
      .collection("3")
      .doc("3")
      .collection("4")
      .doc("4")
      .collection(uid);
    await deep.add({ foo: "bar" });

    expect(deep.path.split("/").length / 2).toBeGreaterThan(config.searchDepth);

    await discover(uid, root);

    await new Promise((resolve) => setTimeout(resolve, 10000));
    expect((await deep.get()).empty).toBe(false);
  });
});

describe("deletion topic", () => {
  test("deletes the paths it is given", async () => {
    const uid = randomId();
    const root = randomId();
    const doc = db.collection(root).doc("path1");
    await doc.set({ uid });
    await db.doc(`${doc.path}/subcollection/child`).set({ foo: "bar" });

    await runBatchPubSubDeletions({ firestorePaths: [doc.path] }, uid, ctx);

    expect(await waitFor(documentGone(doc))).toBe(true);
    expect(
      await waitFor(collectionEmpty(db, `${doc.path}/subcollection`))
    ).toBe(true);
  });

  test("cannot delete paths that belong to another user", async () => {
    const root = randomId();
    const doc = await db.collection(root).add({ uid: "the-real-owner" });

    await runBatchPubSubDeletions(
      { firestorePaths: [doc.path] },
      "invalidUserId",
      ctx
    );

    await new Promise((resolve) => setTimeout(resolve, 10000));
    expect((await doc.get()).exists).toBe(true);
  });
});

describe("account deletion", () => {
  test("clears the configured Firestore path when a user is deleted", async () => {
    const user = await createUser(auth);
    const doc = db.collection("users").doc(user.uid);
    await doc.set({ email: user.email });

    await auth.deleteUser(user.uid);

    expect(await waitFor(documentGone(doc))).toBe(true);
  });
});

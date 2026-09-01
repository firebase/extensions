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

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../src/logs");
vi.mock("../src/events");
vi.mock("node-fetch", () => ({ default: mocks.fetch }));

import * as events from "../src/events";
import { handleClear, handleDeletion, handleSearch } from "../src/handlers";
import * as logs from "../src/logs";
import {
  createFakeFirestore,
  deletionMessages,
  discoveryMessages,
  makeContext,
} from "./fakes";

const UID = "testUid";
const log = vi.mocked(logs);
const publishDeletionEvent = vi.mocked(events.publishDeletionEvent);

beforeEach(() => {
  vi.clearAllMocks();
});

// Parity: delete-user-data/functions/__tests__/handleDelete.test.ts
describe("handleDeletion", () => {
  test("deletes valid paths correctly", async () => {
    const paths = ["valid/path1", "valid/path2"];
    const firestore = createFakeFirestore({
      "valid/path1": { uid: UID },
      "valid/path2": { uid: UID },
    });
    const ctx = makeContext({ firestore });

    await handleDeletion({ uid: UID, paths }, ctx);

    for (const path of paths) {
      expect(firestore.exists(path)).toBe(false);
    }
    expect(log.warnInvalidPaths).not.toHaveBeenCalled();
  });

  test("deletes subcollections of matching docs in recursive mode", async () => {
    const paths = ["valid/path1", "valid/path2"];
    const firestore = createFakeFirestore({
      "valid/path1": { uid: UID },
      "valid/path1/subcollection/doc": { foo: "bar" },
      "valid/path2": { uid: UID },
      "valid/path2/subcollection/doc": { foo: "bar" },
    });
    const ctx = makeContext({
      firestore,
      config: { firestoreDeleteMode: "recursive" },
    });

    await handleDeletion({ uid: UID, paths }, ctx);

    for (const path of paths) {
      expect(firestore.exists(path)).toBe(false);
      expect(firestore.exists(`${path}/subcollection/doc`)).toBe(false);
    }
  });

  test("keeps subcollections of matching docs in shallow mode", async () => {
    const firestore = createFakeFirestore({
      "valid/path1": { uid: UID },
      "valid/path1/subcollection/doc": { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleDeletion({ uid: UID, paths: ["valid/path1"] }, ctx);

    expect(firestore.exists("valid/path1")).toBe(false);
    expect(firestore.exists("valid/path1/subcollection/doc")).toBe(true);
    expect(firestore.recursiveDeleteCalls).toHaveLength(0);
  });

  test("does not delete paths that do not belong to the uid", async () => {
    const firestore = createFakeFirestore({
      "valid/path1": { uid: "someoneElse" },
    });
    const ctx = makeContext({ firestore });

    await handleDeletion({ uid: UID, paths: ["valid/path1"] }, ctx);

    expect(firestore.exists("valid/path1")).toBe(true);
    expect(log.warnInvalidPaths).toHaveBeenCalledWith(1, UID);
  });

  test("deletes a path that contains the uid without a matching field", async () => {
    const firestore = createFakeFirestore({
      [`users/${UID}`]: { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleDeletion({ uid: UID, paths: [`users/${UID}`] }, ctx);

    expect(firestore.exists(`users/${UID}`)).toBe(false);
  });

  test("chunks deletions into batches of 450", async () => {
    const seed: Record<string, Record<string, unknown>> = {};
    const paths: string[] = [];
    for (let index = 0; index < 500; index++) {
      const path = `valid/path${index}`;
      paths.push(path);
      seed[path] = { uid: UID };
    }
    const firestore = createFakeFirestore(seed);
    const ctx = makeContext({ firestore });

    await handleDeletion({ uid: UID, paths }, ctx);

    expect(firestore.batchCommits).toBe(2);
    expect(firestore.store.size).toBe(0);
  });

  test("publishes a firestore deletion event with the invalid paths", async () => {
    const firestore = createFakeFirestore({
      "valid/path1": { uid: UID },
      "valid/path2": { uid: "someoneElse" },
    });
    const ctx = makeContext({ firestore });

    await handleDeletion(
      { uid: UID, paths: ["valid/path1", "valid/path2"] },
      ctx
    );

    expect(publishDeletionEvent).toHaveBeenCalledWith("firestore", {
      uid: UID,
      documentPaths: ["valid/path1", "valid/path2"],
      invalidPaths: ["valid/path2"],
    });
  });
});

// Parity: delete-user-data/functions/__tests__/search.test.ts, which drives the
// same discovery rounds through the Pub/Sub emulator.
describe("handleSearch", () => {
  test("recursively deletes a collection named {uid}", async () => {
    const firestore = createFakeFirestore({
      [`${UID}/doc1`]: { foo: "bar" },
      [`${UID}/doc1/nested/doc2`]: { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: UID, depth: 1, uid: UID }, ctx);

    expect(firestore.store.size).toBe(0);
    expect(publishDeletionEvent).toHaveBeenCalledWith("firestore", {
      uid: UID,
      collectionPath: UID,
    });
  });

  test("queues a document named {uid} for deletion", async () => {
    const firestore = createFakeFirestore({
      [`users/${UID}`]: { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: "users", depth: 1, uid: UID }, ctx);

    expect(deletionMessages(ctx)).toEqual([
      { paths: [`users/${UID}`], uid: UID },
    ]);
  });

  test("queues a document whose search field matches the uid", async () => {
    const firestore = createFakeFirestore({
      "users/doc1": { uid: UID },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: "users", depth: 1, uid: UID }, ctx);

    expect(deletionMessages(ctx)).toEqual([
      { paths: ["users/doc1"], uid: UID },
    ]);
  });

  test("handles a document without any field values", async () => {
    const firestore = createFakeFirestore({ "users/doc1": {} });
    const ctx = makeContext({ firestore });

    await expect(
      handleSearch({ path: "users", depth: 1, uid: UID }, ctx)
    ).resolves.toBeUndefined();
    expect(deletionMessages(ctx)).toEqual([]);
  });

  test("does not queue a document without a matching field value", async () => {
    const firestore = createFakeFirestore({
      "users/doc1": { field1: "unknown" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: "users", depth: 1, uid: UID }, ctx);

    expect(deletionMessages(ctx)).toEqual([]);
    expect(firestore.exists("users/doc1")).toBe(true);
  });

  test("skips field matching entirely when no search fields are configured", async () => {
    const firestore = createFakeFirestore({ "users/doc1": { uid: UID } });
    const ctx = makeContext({ firestore, config: { searchFields: "" } });

    await handleSearch({ path: "users", depth: 1, uid: UID }, ctx);

    expect(deletionMessages(ctx)).toEqual([]);
  });

  test("queues subcollection searches while within the search depth", async () => {
    const firestore = createFakeFirestore({
      "users/doc1/posts/post1": { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: "users", depth: 1, uid: UID }, ctx);

    expect(discoveryMessages(ctx)).toEqual([
      { path: "users/doc1/posts", uid: UID, depth: 2 },
    ]);
  });

  test("does not queue subcollection searches beyond the search depth", async () => {
    const firestore = createFakeFirestore({
      "1/1/2/2/3/3/4/doc": { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch({ path: "1/1/2/2/3", depth: 3, uid: UID }, ctx);

    expect(discoveryMessages(ctx)).toEqual([]);
  });

  test("returns before deleting when the depth exceeds the search depth", async () => {
    const firestore = createFakeFirestore({
      [`1/1/2/2/3/3/4/4/${UID}/doc`]: { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await handleSearch(
      { path: `1/1/2/2/3/3/4/4/${UID}`, depth: 4, uid: UID },
      ctx
    );

    // The collection is named {uid} but sits past the search depth.
    expect(firestore.exists(`1/1/2/2/3/3/4/4/${UID}/doc`)).toBe(true);
    expect(firestore.recursiveDeleteCalls).toHaveLength(0);
    expect(deletionMessages(ctx)).toEqual([]);
    expect(discoveryMessages(ctx)).toEqual([]);
  });
});

// End-to-end discovery, standing in for the extension's emulator round trip:
// handleClear seeds the discovery topic, then every queued message is
// dispatched back into its handler until the queue drains.
describe("auto discovery", () => {
  const clearWithDiscovery = async (
    firestore: ReturnType<typeof createFakeFirestore>,
    config = {}
  ) => {
    const ctx = makeContext({
      firestore,
      config: { enableAutoDiscovery: true, ...config },
    });
    await handleClear(UID, ctx);
    await ctx.drain();
    return ctx;
  };

  test("deletes a top level collection named {uid}", async () => {
    const firestore = createFakeFirestore({ [`${UID}/doc1`]: { foo: "bar" } });

    await clearWithDiscovery(firestore);

    expect(firestore.exists(`${UID}/doc1`)).toBe(false);
  });

  test("deletes a top level document named {uid}", async () => {
    const firestore = createFakeFirestore({ [`users/${UID}`]: { foo: "bar" } });

    await clearWithDiscovery(firestore);

    expect(firestore.exists(`users/${UID}`)).toBe(false);
  });

  test("deletes a document with a field value matching the uid", async () => {
    const firestore = createFakeFirestore({ "users/doc1": { uid: UID } });

    await clearWithDiscovery(firestore);

    expect(firestore.exists("users/doc1")).toBe(false);
  });

  test("deletes a subcollection named {uid}", async () => {
    const firestore = createFakeFirestore({
      [`rooms/room1/${UID}/doc1`]: { foo: "bar" },
    });

    await clearWithDiscovery(firestore);

    expect(firestore.exists(`rooms/room1/${UID}/doc1`)).toBe(false);
  });

  test("does not exceed the search depth for a collection named {uid}", async () => {
    const path = `1/1/2/2/3/3/4/4/${UID}/doc`;
    const firestore = createFakeFirestore({ [path]: { foo: "bar" } });

    await clearWithDiscovery(firestore);

    expect(firestore.exists(path)).toBe(true);
  });

  test("does not exceed the search depth for a document field match", async () => {
    const path = "1/1/2/2/3/3/4/4/5/doc";
    const firestore = createFakeFirestore({ [path]: { uid: UID } });

    await clearWithDiscovery(firestore);

    expect(firestore.exists(path)).toBe(true);
  });

  test("does not delete documents that do not match the search criteria", async () => {
    const firestore = createFakeFirestore({
      "users/doc1": { testing: "should-not-delete" },
      "users/doc1/posts/post1": { field1: "unknown" },
    });

    await clearWithDiscovery(firestore);

    expect(firestore.exists("users/doc1")).toBe(true);
    expect(firestore.exists("users/doc1/posts/post1")).toBe(true);
  });

  test("is not run when auto discovery is disabled", async () => {
    const firestore = createFakeFirestore({ [`${UID}/doc1`]: { foo: "bar" } });
    const ctx = makeContext({ firestore });

    await handleClear(UID, ctx);

    expect(discoveryMessages(ctx)).toEqual([]);
    expect(firestore.exists(`${UID}/doc1`)).toBe(true);
  });
});

describe("handleClear", () => {
  test("deletes the configured firestore paths in shallow mode", async () => {
    const firestore = createFakeFirestore({
      [`users/${UID}`]: { foo: "bar" },
      [`users/${UID}/posts/post1`]: { foo: "bar" },
    });
    const ctx = makeContext({
      firestore,
      config: { firestorePaths: "users/{UID}" },
    });

    await handleClear(UID, ctx);

    expect(firestore.exists(`users/${UID}`)).toBe(false);
    expect(firestore.exists(`users/${UID}/posts/post1`)).toBe(true);
    expect(log.firestorePathDeleted).toHaveBeenCalledWith(
      `users/${UID}`,
      false
    );
  });

  test("deletes the configured firestore paths in recursive mode", async () => {
    const firestore = createFakeFirestore({
      [`users/${UID}`]: { foo: "bar" },
      [`users/${UID}/posts/post1`]: { foo: "bar" },
    });
    const ctx = makeContext({
      firestore,
      config: {
        firestorePaths: "users/{UID}",
        firestoreDeleteMode: "recursive",
      },
    });

    await handleClear(UID, ctx);

    expect(firestore.exists(`users/${UID}`)).toBe(false);
    expect(firestore.exists(`users/${UID}/posts/post1`)).toBe(false);
  });

  test("deletes the configured rtdb paths", async () => {
    const ctx = makeContext({
      config: { rtdbPaths: "users/{UID},admins/{UID}" },
    });

    await handleClear(UID, ctx);

    expect(ctx.rtdbRemovals).toEqual([`users/${UID}`, `admins/${UID}`]);
    expect(publishDeletionEvent).toHaveBeenCalledWith("database", {
      uid: UID,
      paths: [`users/${UID}`, `admins/${UID}`],
    });
  });

  test("deletes the configured storage paths", async () => {
    const ctx = makeContext({
      config: {
        storagePaths: `{DEFAULT}/{UID}/avatar.png,other-bucket/{UID}`,
        storageBucket: "default-bucket",
      },
    });

    await handleClear(UID, ctx);

    expect(ctx.storageDeletions).toEqual(
      expect.arrayContaining([
        { bucket: "default-bucket", prefix: `${UID}/avatar.png` },
        { bucket: "other-bucket", prefix: UID },
      ])
    );
  });

  test("tolerates a 404 from storage", async () => {
    const ctx = makeContext({
      config: { storagePaths: "{DEFAULT}/{UID}", storageBucket: "bucket" },
      storageError: { code: 404 },
    });

    await handleClear(UID, ctx);

    expect(log.storagePath404).toHaveBeenCalledWith(UID);
    expect(log.storagePathError).not.toHaveBeenCalled();
  });

  test("logs other storage errors", async () => {
    const error = Object.assign(new Error("boom"), { code: 500 });
    const ctx = makeContext({
      config: { storagePaths: "{DEFAULT}/{UID}", storageBucket: "bucket" },
      storageError: error,
    });

    await handleClear(UID, ctx);

    expect(log.storagePathError).toHaveBeenCalledWith(UID, error);
  });

  test("logs rtdb errors without failing", async () => {
    const error = new Error("boom");
    const ctx = makeContext({
      config: { rtdbPaths: "users/{UID}" },
      rtdbError: error,
    });

    await expect(handleClear(UID, ctx)).resolves.toBeUndefined();
    expect(log.rtdbPathError).toHaveBeenCalledWith(`users/${UID}`, error);
  });

  test("skips each target that is not configured", async () => {
    const ctx = makeContext();

    await handleClear(UID, ctx);

    expect(log.firestoreNotConfigured).toHaveBeenCalled();
    expect(log.rtdbNotConfigured).toHaveBeenCalled();
    expect(log.storageNotConfigured).toHaveBeenCalled();
    expect(log.complete).toHaveBeenCalledWith(UID);
  });

  // Parity: delete-user-data/functions/__tests__/searchFunction.test.ts
  test("deletes the paths returned by a custom search function", async () => {
    const firestore = createFakeFirestore({
      "searchFunction/testing": { uid: UID },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => [`searchFunction/testing`],
    });
    const ctx = makeContext({
      firestore,
      config: { searchFunction: "https://example.com/search" },
    });

    await handleClear(UID, ctx);
    await ctx.drain();

    expect(mocks.fetch).toHaveBeenCalledWith("https://example.com/search", {
      method: "POST",
      body: JSON.stringify({ uid: UID }),
      headers: { "Content-Type": "application/json" },
    });
    expect(firestore.exists("searchFunction/testing")).toBe(false);
  });

  test("does not call a custom search function when none is configured", async () => {
    const ctx = makeContext();

    await handleClear(UID, ctx);

    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

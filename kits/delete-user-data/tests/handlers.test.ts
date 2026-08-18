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

import type { PubSub } from "@google-cloud/pubsub";
import type * as admin from "firebase-admin";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/events");
vi.mock("../src/logs");
vi.mock("../src/recursiveDelete");
vi.mock("../src/runCustomSearchFunction");

import * as events from "../src/events";
import {
  type DeleteUserDataConfig,
  resolveDeleteUserDataConfig,
} from "../src/export-config";
import {
  type HandlerContext,
  handleClear,
  handleDeletion,
  handleSearch,
} from "../src/handlers";
import * as logs from "../src/logs";
import { recursiveDelete } from "../src/recursiveDelete";
import { runCustomSearchFunction } from "../src/runCustomSearchFunction";

interface FakeDoc {
  id: string;
  path: string;
  data?: Record<string, unknown>;
  collections?: string[];
}

/**
 * Firestore double backed by a flat map of documents. Only the surface the
 * handlers touch is implemented: batches, references, listDocuments and getAll.
 */
function fakeFirestore(docs: FakeDoc[] = []) {
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  const batches: { deleted: string[]; committed: boolean }[] = [];
  const transactionDeletes: string[] = [];

  const snapshotOf = (doc: FakeDoc | undefined, path: string) => ({
    exists: doc?.data !== undefined,
    ref: { path },
    get: (fieldPath: unknown) => doc?.data?.[String(fieldPath)],
  });

  const docRef = (path: string) => ({
    id: path.split("/").pop() as string,
    path,
    get: async () => snapshotOf(byPath.get(path), path),
    listCollections: async () =>
      (byPath.get(path)?.collections ?? []).map((id) => ({
        id,
        path: `${path}/${id}`,
      })),
  });

  const firestore = {
    batch: () => {
      const batch = { deleted: [] as string[], committed: false };
      batches.push(batch);
      return {
        delete: (ref: { path: string }) => batch.deleted.push(ref.path),
        commit: async () => {
          batch.committed = true;
        },
      };
    },
    doc: (path: string) => docRef(path),
    collection: (path: string) => ({
      id: path.split("/").pop() as string,
      path,
      listDocuments: async () =>
        docs
          .filter((doc) => doc.path.startsWith(`${path}/`))
          .filter(
            (doc) => doc.path.split("/").length === path.split("/").length + 1
          )
          .map((doc) => docRef(doc.path)),
    }),
    getAll: async (...refs: { path: string }[]) =>
      refs.map((ref) => snapshotOf(byPath.get(ref.path), ref.path)),
    runTransaction: async (
      updateFunction: (transaction: {
        delete: (ref: { path: string }) => void;
      }) => Promise<void>
    ) =>
      updateFunction({
        delete: (ref: { path: string }) => transactionDeletes.push(ref.path),
      }),
  };

  return {
    firestore: firestore as unknown as admin.firestore.Firestore,
    batches,
    transactionDeletes,
  };
}

function makeCtx(
  configOverrides: Partial<DeleteUserDataConfig> = {},
  docs: FakeDoc[] = []
) {
  const { firestore, batches, transactionDeletes } = fakeFirestore(docs);
  const published: unknown[] = [];
  const removed: string[] = [];
  const deleteFiles = vi.fn().mockResolvedValue(undefined);
  const bucket = vi.fn(() => ({ deleteFiles }));

  const ctx: HandlerContext = {
    firestore,
    storage: { bucket } as unknown as admin.storage.Storage,
    database: {
      ref: (path: string) => ({
        remove: async () => {
          removed.push(path);
        },
      }),
    } as unknown as admin.database.Database,
    pubsub: {
      topic: () => ({
        publishMessage: (message: { json: unknown }) => {
          published.push(message.json);
          return Promise.resolve("id");
        },
      }),
    } as unknown as PubSub,
    config: resolveDeleteUserDataConfig({
      instanceId: "inst",
      projectId: "test-project",
      ...configOverrides,
    }),
  };

  return {
    ctx,
    published,
    batches,
    transactionDeletes,
    removed,
    bucket,
    deleteFiles,
  };
}

describe("handleDeletion", () => {
  beforeEach(() => vi.clearAllMocks());

  test("recursively deletes paths that belong to the uid", async () => {
    const { ctx } = makeCtx({ firestoreDeleteMode: "recursive" }, [
      { id: "path1", path: "valid/path1", data: { uid: "testUid" } },
      { id: "path2", path: "valid/path2", data: { uid: "testUid" } },
    ]);

    await handleDeletion(
      { uid: "testUid", paths: ["valid/path1", "valid/path2"] },
      ctx
    );

    expect(recursiveDelete).toHaveBeenCalledTimes(2);
    expect(recursiveDelete).toHaveBeenCalledWith("valid/path1", ctx.firestore);
    expect(recursiveDelete).toHaveBeenCalledWith("valid/path2", ctx.firestore);
  });

  test("deletes through a batch in shallow mode", async () => {
    const { ctx, batches } = makeCtx({ firestoreDeleteMode: "shallow" }, [
      { id: "path1", path: "valid/path1", data: { uid: "testUid" } },
    ]);

    await handleDeletion({ uid: "testUid", paths: ["valid/path1"] }, ctx);

    expect(recursiveDelete).not.toHaveBeenCalled();
    expect(batches).toEqual([{ deleted: ["valid/path1"], committed: true }]);
  });

  test("cannot delete paths that do not belong to the uid", async () => {
    const { ctx, batches } = makeCtx({ firestoreDeleteMode: "recursive" }, [
      { id: "doc1", path: "collection/doc1", data: { uid: "someoneElse" } },
    ]);

    await handleDeletion(
      { uid: "invalidUserId", paths: ["collection/doc1"] },
      ctx
    );

    expect(recursiveDelete).not.toHaveBeenCalled();
    expect(batches[0].deleted).toEqual([]);
    expect(logs.warnInvalidPaths).toHaveBeenCalledWith(1, "invalidUserId");
  });

  test("publishes the deletion event with the invalid paths", async () => {
    const { ctx } = makeCtx({ firestoreDeleteMode: "recursive" }, [
      { id: "path1", path: "valid/path1", data: { uid: "testUid" } },
    ]);

    await handleDeletion(
      { uid: "testUid", paths: ["valid/path1", "other/path2"] },
      ctx
    );

    expect(events.publishDeletionEvent).toHaveBeenCalledWith("firestore", {
      uid: "testUid",
      documentPaths: ["valid/path1", "other/path2"],
      invalidPaths: ["other/path2"],
    });
  });

  test("commits one batch per chunk of 450 paths", async () => {
    const paths = Array.from(
      { length: 901 },
      (_, i) => `users/testUid/doc${i}`
    );
    const { ctx, batches } = makeCtx({ firestoreDeleteMode: "shallow" });

    await handleDeletion({ uid: "testUid", paths }, ctx);

    expect(batches).toHaveLength(3);
    expect(batches.map((batch) => batch.deleted.length)).toEqual([450, 450, 1]);
    expect(batches.every((batch) => batch.committed)).toBe(true);
  });
});

describe("handleSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  test("deletes a collection named after the uid", async () => {
    const { ctx } = makeCtx();

    await handleSearch({ path: "parent/doc/uid1", depth: 1, uid: "uid1" }, ctx);

    expect(recursiveDelete).toHaveBeenCalledWith(
      "parent/doc/uid1",
      ctx.firestore
    );
    expect(events.publishDeletionEvent).toHaveBeenCalledWith("firestore", {
      uid: "uid1",
      collectionPath: "parent/doc/uid1",
    });
  });

  test("queues a document named after the uid for deletion", async () => {
    const { ctx, published } = makeCtx({}, [
      { id: "uid1", path: "posts/uid1", data: {} },
    ]);

    await handleSearch({ path: "posts", depth: 1, uid: "uid1" }, ctx);

    expect(published).toContainEqual({ paths: ["posts/uid1"], uid: "uid1" });
  });

  test("queues a document whose search field holds the uid", async () => {
    const { ctx, published } = makeCtx({ searchFields: "uid" }, [
      { id: "doc1", path: "posts/doc1", data: { uid: "uid1" } },
    ]);

    await handleSearch({ path: "posts", depth: 1, uid: "uid1" }, ctx);

    expect(published).toContainEqual({ paths: ["posts/doc1"], uid: "uid1" });
  });

  test("does not queue documents that match nothing", async () => {
    const { ctx, published } = makeCtx({ searchFields: "uid" }, [
      { id: "doc1", path: "posts/doc1", data: { uid: "someoneElse" } },
    ]);

    await handleSearch({ path: "posts", depth: 1, uid: "uid1" }, ctx);

    expect(published).not.toContainEqual(
      expect.objectContaining({ paths: ["posts/doc1"] })
    );
  });

  test("does not exceed the configured search depth", async () => {
    const { ctx, published } = makeCtx({ searchDepth: 3 }, [
      { id: "uid1", path: "posts/uid1", data: {} },
    ]);

    await handleSearch({ path: "posts", depth: 4, uid: "uid1" }, ctx);

    expect(recursiveDelete).not.toHaveBeenCalled();
    expect(published).toHaveLength(0);
  });

  test("recurses into child documents while within the search depth", async () => {
    const { ctx, published } = makeCtx({ searchDepth: 3 }, [
      { id: "doc1", path: "posts/doc1", data: {}, collections: ["comments"] },
    ]);

    await handleSearch({ path: "posts", depth: 1, uid: "uid1" }, ctx);

    expect(published).toContainEqual({
      path: "posts/doc1/comments",
      uid: "uid1",
      depth: 2,
    });
  });

  test("skips field matching when no search fields are configured", async () => {
    const { ctx, published } = makeCtx({ searchFields: "" }, [
      { id: "doc1", path: "posts/doc1", data: { uid: "uid1" } },
    ]);

    await handleSearch({ path: "posts", depth: 1, uid: "uid1" }, ctx);

    expect(published).toHaveLength(0);
  });
});

describe("handleClear", () => {
  beforeEach(() => vi.clearAllMocks());

  test("deletes the configured Firestore paths shallowly", async () => {
    const { ctx, transactionDeletes } = makeCtx({
      firestorePaths: "users/{UID},logs/{UID}",
      firestoreDeleteMode: "shallow",
    });

    await handleClear("uid1", ctx);

    expect(transactionDeletes.sort()).toEqual(["logs/uid1", "users/uid1"]);
    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  test("deletes the configured Firestore paths recursively", async () => {
    const { ctx } = makeCtx({
      firestorePaths: "users/{UID}",
      firestoreDeleteMode: "recursive",
    });

    await handleClear("uid1", ctx);

    expect(recursiveDelete).toHaveBeenCalledWith("users/uid1", ctx.firestore);
  });

  test("removes the configured RTDB paths", async () => {
    const { ctx, removed } = makeCtx({ rtdbPaths: "users/{UID}" });

    await handleClear("uid1", ctx);

    expect(removed).toEqual(["users/uid1"]);
  });

  test("resolves {DEFAULT} to the configured storage bucket", async () => {
    const { ctx, bucket, deleteFiles } = makeCtx({
      storagePaths: "{DEFAULT}/users/{UID}/avatar",
      storageBucket: "my-bucket",
    });

    await handleClear("uid1", ctx);

    expect(bucket).toHaveBeenCalledWith("my-bucket");
    expect(deleteFiles).toHaveBeenCalledWith({ prefix: "users/uid1/avatar" });
  });

  test("treats a missing storage prefix as nothing to delete", async () => {
    const { ctx, deleteFiles } = makeCtx({
      storagePaths: "{DEFAULT}/users/{UID}",
      storageBucket: "my-bucket",
    });
    deleteFiles.mockRejectedValueOnce({ code: 404 });

    await handleClear("uid1", ctx);

    expect(logs.storagePath404).toHaveBeenCalledWith("users/uid1");
    expect(logs.storagePathError).not.toHaveBeenCalled();
  });

  test("logs which targets are not configured", async () => {
    const { ctx } = makeCtx();

    await handleClear("uid1", ctx);

    expect(logs.firestoreNotConfigured).toHaveBeenCalled();
    expect(logs.rtdbNotConfigured).toHaveBeenCalled();
    expect(logs.storageNotConfigured).toHaveBeenCalled();
  });

  test("starts auto discovery only when it is enabled", async () => {
    const { ctx, published } = makeCtx({ enableAutoDiscovery: true });
    (
      ctx.firestore as unknown as { listCollections: () => Promise<unknown[]> }
    ).listCollections = async () => [{ path: "users" }];

    await handleClear("uid1", ctx);

    expect(published).toEqual([{ path: "users", uid: "uid1", depth: 1 }]);
  });

  test("runs the custom search function when one is configured", async () => {
    const { ctx } = makeCtx({ searchFunction: "https://example.com/search" });

    await handleClear("uid1", ctx);

    expect(runCustomSearchFunction).toHaveBeenCalledWith("uid1", ctx);
  });
});

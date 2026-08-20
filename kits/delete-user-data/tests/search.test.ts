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

vi.mock("../src/logs", () => ({
  complete: vi.fn(),
  customFunctionError: vi.fn(),
  firestoreDeleted: vi.fn(),
  firestoreDeleting: vi.fn(),
  firestoreNotConfigured: vi.fn(),
  firestorePathDeleted: vi.fn(),
  firestorePathDeleting: vi.fn(),
  firestorePathError: vi.fn(),
  init: vi.fn(),
  rtdbDeleted: vi.fn(),
  rtdbDeleting: vi.fn(),
  rtdbNotConfigured: vi.fn(),
  rtdbPathDeleted: vi.fn(),
  rtdbPathDeleting: vi.fn(),
  rtdbPathError: vi.fn(),
  start: vi.fn(),
  storageDeleted: vi.fn(),
  storageDeleting: vi.fn(),
  storageNotConfigured: vi.fn(),
  storagePath404: vi.fn(),
  storagePathDeleted: vi.fn(),
  storagePathDeleting: vi.fn(),
  storagePathError: vi.fn(),
  warnInvalidPaths: vi.fn(),
}));

import { search } from "../src/search";
import { createFakeFirestore, discoveryMessages, makeContext } from "./fakes";

const UID = "testUid";

beforeEach(() => {
  vi.clearAllMocks();
});

// Parity: the discovery fan-out asserted indirectly by
// delete-user-data/functions/__tests__/search.test.ts.
describe("search", () => {
  test("queues every top level collection for discovery", async () => {
    const firestore = createFakeFirestore({
      "users/doc1": { foo: "bar" },
      "rooms/room1": { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await search(UID, 1, firestore as any, ctx);

    expect(discoveryMessages(ctx)).toEqual([
      { path: "users", uid: UID, depth: 1 },
      { path: "rooms", uid: UID, depth: 1 },
    ]);
  });

  test("queues only the subcollections of the given document", async () => {
    const firestore = createFakeFirestore({
      "users/doc1/posts/post1": { foo: "bar" },
      "users/doc1/comments/comment1": { foo: "bar" },
      "users/doc2/posts/post1": { foo: "bar" },
    });
    const ctx = makeContext({ firestore });

    await search(UID, 2, firestore as any, ctx, firestore.doc("users/doc1"));

    expect(discoveryMessages(ctx)).toEqual([
      { path: "users/doc1/posts", uid: UID, depth: 2 },
      { path: "users/doc1/comments", uid: UID, depth: 2 },
    ]);
  });

  test("queues nothing for a document without subcollections", async () => {
    const firestore = createFakeFirestore({ "users/doc1": { foo: "bar" } });
    const ctx = makeContext({ firestore });

    await search(UID, -1, firestore as any, ctx, firestore.doc("users/doc1"));

    expect(discoveryMessages(ctx)).toEqual([]);
    expect(firestore.exists("users/doc1")).toBe(true);
  });

  test("queues nothing for an empty database", async () => {
    const firestore = createFakeFirestore();
    const ctx = makeContext({ firestore });

    await search(UID, 1, firestore as any, ctx);

    expect(discoveryMessages(ctx)).toEqual([]);
  });

  test("publishes to the configured discovery topic", async () => {
    const firestore = createFakeFirestore({ "users/doc1": { foo: "bar" } });
    const ctx = makeContext({
      firestore,
      config: {
        discoveryTopicName: "custom-discovery",
        projectId: "demo-test",
      },
    });

    await search(UID, 1, firestore as any, ctx);

    expect(ctx.pubsub.published).toEqual([
      {
        topic: "projects/demo-test/topics/custom-discovery",
        json: { path: "users", uid: UID, depth: 1 },
      },
    ]);
  });
});

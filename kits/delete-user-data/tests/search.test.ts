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

import type * as admin from "firebase-admin";
import type { PubSub } from "@google-cloud/pubsub";
import { describe, expect, test } from "vitest";

import { resolveDeleteUserDataConfig } from "../src/export-config";
import type { PublisherContext } from "../src/runBatchPubSubDeletions";
import { search } from "../src/search";

function makeCtx() {
  const published: unknown[] = [];
  const ctx: PublisherContext = {
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
    }),
  };
  return { ctx, published };
}

describe("search", () => {
  test("queues every top-level collection for discovery", async () => {
    const { ctx, published } = makeCtx();
    const db = {
      listCollections: async () => [{ path: "users" }, { path: "logs" }],
    } as unknown as admin.firestore.Firestore;

    await search("uid1", 1, db, ctx);

    expect(published).toEqual([
      { path: "users", uid: "uid1", depth: 1 },
      { path: "logs", uid: "uid1", depth: 1 },
    ]);
  });

  test("queues the subcollections of a document when one is given", async () => {
    const { ctx, published } = makeCtx();
    const document = {
      listCollections: async () => [{ path: "users/uid1/orders" }],
    } as unknown as admin.firestore.DocumentReference;
    const db = {
      listCollections: async () => {
        throw new Error("should not list root collections");
      },
    } as unknown as admin.firestore.Firestore;

    await search("uid1", 2, db, ctx, document);

    expect(published).toEqual([
      { path: "users/uid1/orders", uid: "uid1", depth: 2 },
    ]);
  });

  test("publishes nothing when there are no collections", async () => {
    const { ctx, published } = makeCtx();
    const db = {
      listCollections: async () => [],
    } as unknown as admin.firestore.Firestore;

    await search("uid1", 1, db, ctx);

    expect(published).toHaveLength(0);
  });
});

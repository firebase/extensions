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

import { afterEach, describe, expect, test, vi } from "vitest";
import { recursiveDelete } from "../src/recursiveDelete";
import { createFakeFirestore } from "./fakes";

afterEach(() => {
  vi.restoreAllMocks();
});

// Parity: delete-user-data/functions/__tests__/recursiveDelete.test.ts
describe("recursiveDelete", () => {
  test("successfully deletes a document reference", async () => {
    const db = createFakeFirestore({ "documents/doc1": { foo: "bar" } });

    await recursiveDelete("documents/doc1", db as any);

    expect(db.exists("documents/doc1")).toBe(false);
    expect(db.recursiveDeleteCalls).toEqual([
      { path: "documents/doc1", type: "document" },
    ]);
  });

  test("successfully deletes a collection reference", async () => {
    const db = createFakeFirestore({
      "documents/doc1/collection1/doc2": { foo: "bar" },
    });

    await recursiveDelete("documents/doc1/collection1", db as any);

    const collection = await db.collection("documents/doc1/collection1").get();
    expect(collection.docs.length).toBe(0);
    expect(db.recursiveDeleteCalls).toEqual([
      { path: "documents/doc1/collection1", type: "collection" },
    ]);
  });

  test("successfully deletes a document with a subcollection", async () => {
    const db = createFakeFirestore({
      "documents/doc1": { foo: "bar" },
      "documents/doc1/collection1/doc2/collection2/doc3": { foo: "bar" },
    });

    await recursiveDelete("documents/doc1", db as any);

    const collection = await db
      .collection("documents/doc1/collection1/doc2/collection2")
      .get();
    expect(collection.docs.length).toBe(0);
    expect(db.exists("documents/doc1")).toBe(false);
  });

  test("leaves sibling documents untouched", async () => {
    const db = createFakeFirestore({
      "documents/doc1": { foo: "bar" },
      "documents/doc10": { foo: "bar" },
    });

    await recursiveDelete("documents/doc1", db as any);

    expect(db.exists("documents/doc1")).toBe(false);
    expect(db.exists("documents/doc10")).toBe(true);
  });

  test("retries a failed write up to the retry limit", async () => {
    const db = createFakeFirestore();
    const onWriteError = vi.fn();
    db.bulkWriter = () => ({ onWriteError, close: async () => undefined });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await recursiveDelete("documents/doc1", db as any);

    const handler = onWriteError.mock.calls[0][0] as (
      error: unknown
    ) => boolean;
    const error = {
      failedAttempts: 1,
      documentRef: { path: "documents/doc1" },
    };

    expect(handler(error)).toBe(true);
    expect(handler({ ...error, failedAttempts: 3 })).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "Failed to delete document: ",
      "documents/doc1"
    );
  });
});

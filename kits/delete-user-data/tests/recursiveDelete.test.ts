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
import { beforeEach, describe, expect, test, vi } from "vitest";

import { recursiveDelete } from "../src/recursiveDelete";

/** Fake Firestore exposing only what recursiveDelete touches. */
function fakeFirestore() {
  const bulkWriter = { onWriteError: vi.fn(), close: vi.fn() };
  const db = {
    bulkWriter: vi.fn(() => bulkWriter),
    doc: vi.fn((path: string) => ({ kind: "document", path })),
    collection: vi.fn((path: string) => ({ kind: "collection", path })),
    recursiveDelete: vi.fn().mockResolvedValue(undefined),
  };
  return {
    bulkWriter,
    db: db as unknown as admin.firestore.Firestore,
    calls: db,
  };
}

describe("recursiveDelete", () => {
  beforeEach(() => vi.clearAllMocks());

  test("deletes a document reference for an even number of segments", async () => {
    const { db, calls, bulkWriter } = fakeFirestore();

    await recursiveDelete("documents/doc1", db);

    expect(calls.doc).toHaveBeenCalledWith("documents/doc1");
    expect(calls.collection).not.toHaveBeenCalled();
    expect(calls.recursiveDelete).toHaveBeenCalledWith(
      { kind: "document", path: "documents/doc1" },
      bulkWriter
    );
  });

  test("deletes a collection reference for an odd number of segments", async () => {
    const { db, calls, bulkWriter } = fakeFirestore();

    await recursiveDelete("documents/doc1/collection1", db);

    expect(calls.collection).toHaveBeenCalledWith("documents/doc1/collection1");
    expect(calls.doc).not.toHaveBeenCalled();
    expect(calls.recursiveDelete).toHaveBeenCalledWith(
      { kind: "collection", path: "documents/doc1/collection1" },
      bulkWriter
    );
  });

  test("deletes a document by reference so subcollections go with it", async () => {
    const { db, calls } = fakeFirestore();

    await recursiveDelete("documents/doc1", db);

    // Firestore's recursiveDelete removes descendants of the reference it is
    // given, so a nested collection needs no separate call.
    expect(calls.recursiveDelete).toHaveBeenCalledTimes(1);
  });

  test("retries a failed write up to three attempts", async () => {
    const { db, bulkWriter } = fakeFirestore();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await recursiveDelete("documents/doc1", db);

    const [onError] = bulkWriter.onWriteError.mock.calls[0];
    const error = (failedAttempts: number) => ({
      failedAttempts,
      documentRef: { path: "documents/doc1" },
    });

    expect(onError(error(1))).toBe(true);
    expect(onError(error(2))).toBe(true);
    expect(onError(error(3))).toBe(false);
  });
});

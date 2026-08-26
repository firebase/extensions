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
import { https } from "firebase-functions/v1";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Prefilter } from "../src/queries";
import { FirestoreVectorStoreClient } from "../src/vector-store";

/**
 * A fake Firestore whose collection reference is a chainable
 * `where`/`findNearest`/`get` stub, so the client's query building is
 * observable without touching a real database.
 */
function fakeFirestore(
  docs: Array<{ ref: { id: string } }> = [
    { ref: { id: "doc-1" } },
    { ref: { id: "doc-2" } },
  ]
) {
  const chain = {
    where: vi.fn(),
    findNearest: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs }),
  };
  chain.where.mockReturnValue(chain);
  chain.findNearest.mockReturnValue(chain);
  const collection = vi.fn(() => chain);
  return {
    firestore: { collection } as unknown as Firestore,
    collection,
    chain,
  };
}

describe("FirestoreVectorStoreClient", () => {
  const query = [0.1, 0.2, 0.3];
  const prefilters: Prefilter[] = [
    { field: "category", operator: "==", value: "test" },
  ];
  const limit = 5;
  const outputField = "embedding";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("applies prefilters and findNearest, returning document ids", async () => {
    const { firestore, collection, chain } = fakeFirestore();
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const result = await client.query(
      query,
      "test-collection",
      prefilters,
      limit,
      outputField
    );

    expect(collection).toHaveBeenCalledWith("test-collection");
    expect(chain.where).toHaveBeenCalledWith("category", "==", "test");
    expect(chain.findNearest).toHaveBeenCalledWith(outputField, query, {
      limit,
      distanceMeasure: "COSINE",
    });
    expect(result).toEqual({ ids: ["doc-1", "doc-2"] });
  });

  test("queries without prefilters", async () => {
    const { firestore, chain } = fakeFirestore();
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const result = await client.query(
      query,
      "test-collection",
      [],
      limit,
      outputField
    );

    expect(chain.where).not.toHaveBeenCalled();
    expect(chain.findNearest).toHaveBeenCalledWith(outputField, query, {
      limit,
      distanceMeasure: "COSINE",
    });
    expect(result).toEqual({ ids: ["doc-1", "doc-2"] });
  });

  test("passes the configured distance measure through", async () => {
    const { firestore, chain } = fakeFirestore();
    const client = new FirestoreVectorStoreClient(firestore, "DOT_PRODUCT");

    await client.query(query, "test-collection", [], limit, outputField);

    expect(chain.findNearest).toHaveBeenCalledWith(outputField, query, {
      limit,
      distanceMeasure: "DOT_PRODUCT",
    });
  });

  test("returns an empty id list when nothing matches", async () => {
    const { firestore } = fakeFirestore([]);
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    await expect(
      client.query(query, "test-collection", [], limit, outputField)
    ).resolves.toEqual({ ids: [] });
  });

  test("transforms a Firestore error into an HttpsError", async () => {
    const { firestore } = fakeFirestore();
    (
      firestore.collection as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error("Permission denied.");
    });
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const err = await client
      .query(query, "test-collection", prefilters, limit, outputField)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(https.HttpsError);
    expect((err as https.HttpsError).code).toBe("unknown");
    expect((err as https.HttpsError).message).toBe("Permission denied.");
  });

  test("transforms a rejected get() into an HttpsError", async () => {
    const { firestore, chain } = fakeFirestore();
    chain.get.mockRejectedValue(new Error("Query failed"));
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const err = await client
      .query(query, "test-collection", [], limit, outputField)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(https.HttpsError);
    expect((err as https.HttpsError).code).toBe("unknown");
    expect((err as https.HttpsError).message).toBe("Query failed");
  });

  test("rethrows an existing HttpsError unchanged", async () => {
    const { firestore } = fakeFirestore();
    const original = new https.HttpsError(
      "permission-denied",
      "Permission denied."
    );
    (
      firestore.collection as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw original;
    });
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const err = await client
      .query(query, "test-collection", [], limit, outputField)
      .catch((e: unknown) => e);

    expect(err).toBe(original);
    expect((err as https.HttpsError).code).toBe("permission-denied");
  });

  test("falls back to a generic message for non-Error throws", async () => {
    const { firestore } = fakeFirestore();
    (
      firestore.collection as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw "boom";
    });
    const client = new FirestoreVectorStoreClient(firestore, "COSINE");

    const err = await client
      .query(query, "test-collection", [], limit, outputField)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(https.HttpsError);
    expect((err as https.HttpsError).message).toBe("Vector query failed");
  });
});

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

import { FieldValue } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

const { getSingleEmbedding, getEmbeddings } = vi.hoisted(() => ({
  getSingleEmbedding: vi.fn(),
  getEmbeddings: vi.fn(),
}));

vi.mock("../src/embeddings", () => ({
  createEmbedClient: vi.fn(() => ({
    batchSize: 1,
    getEmbeddings,
    getSingleEmbedding,
  })),
}));

// `queries/setup` builds a FirestoreAdminClient at module scope; the query
// handler never needs it.
vi.mock("../src/queries/setup", () => ({ createIndex: vi.fn() }));

import {
  type HandlerContext,
  type VectorWriteEvent,
  handleEmbedOnWrite,
  handleQueryCall,
} from "../src/handlers";
import { resolveVectorSearchConfig } from "../src/export-config";

const config = resolveVectorSearchConfig({
  projectId: "test-project",
  instanceId: "test-instance",
});

const EMBEDDING = [0.1, 0.2, 0.3];
const IDS = ["doc-1", "doc-2"];

/** A HandlerContext whose Firestore returns `IDS` from any vector query. */
function makeCtx() {
  const chain = {
    where: vi.fn(),
    findNearest: vi.fn(),
    get: vi
      .fn()
      .mockResolvedValue({ docs: IDS.map((id) => ({ ref: { id } })) }),
  };
  chain.where.mockReturnValue(chain);
  chain.findNearest.mockReturnValue(chain);
  const collection = vi.fn(() => chain);
  const ctx = {
    firestore: { collection },
    config,
  } as unknown as HandlerContext;
  return { ctx, collection, chain };
}

function request(data: unknown, auth: unknown = { uid: "test-user" }) {
  return { data, auth } as unknown as CallableRequest<unknown>;
}

describe("handleQueryCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  test("handles a query with the default limit", async () => {
    const { ctx, collection, chain } = makeCtx();

    const result = await handleQueryCall(request({ query: "test query" }), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(collection).toHaveBeenCalledWith(config.collectionPath);
    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      {
        limit: config.defaultQueryLimit,
        distanceMeasure: config.distanceMeasure,
      }
    );
    expect(result).toEqual({ ids: IDS });
  });

  test("handles a query with a custom limit", async () => {
    const { ctx, chain } = makeCtx();

    const result = await handleQueryCall(
      request({ query: "test query", limit: 5 }),
      ctx
    );

    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      { limit: 5, distanceMeasure: config.distanceMeasure }
    );
    expect(result).toEqual({ ids: IDS });
  });

  test("coerces a string limit", async () => {
    const { ctx, chain } = makeCtx();

    await handleQueryCall(request({ query: "test query", limit: "7" }), ctx);

    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      { limit: 7, distanceMeasure: config.distanceMeasure }
    );
  });

  test("handles a query with prefilters", async () => {
    const { ctx, chain } = makeCtx();
    const prefilters = [{ field: "category", operator: "==", value: "test" }];

    const result = await handleQueryCall(
      request({ query: "test query", prefilters }),
      ctx
    );

    expect(chain.where).toHaveBeenCalledWith("category", "==", "test");
    expect(result).toEqual({ ids: IDS });
  });

  test("throws unauthenticated when there is no auth context", async () => {
    const { ctx } = makeCtx();

    const err = await handleQueryCall(
      request({ query: "test query" }, null),
      ctx
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpsError);
    expect((err as HttpsError).code).toBe("unauthenticated");
    expect((err as HttpsError).message).toBe(
      "The function must be called while authenticated."
    );
    expect(getSingleEmbedding).not.toHaveBeenCalled();
  });

  test("rejects a missing query field before embedding", async () => {
    const { ctx } = makeCtx();

    await expect(handleQueryCall(request({ limit: 5 }), ctx)).rejects.toThrow(
      z.ZodError
    );
    expect(getSingleEmbedding).not.toHaveBeenCalled();
  });

  test("surfaces the schema issues for an empty payload", async () => {
    const { ctx } = makeCtx();

    const err = (await handleQueryCall(request({}), ctx).catch(
      (e: unknown) => e
    )) as z.ZodError;

    expect(err).toBeInstanceOf(z.ZodError);
    expect(Array.isArray(err.issues)).toBe(true);
    expect(err.issues.length).toBeGreaterThan(0);
  });

  test("rejects an invalid limit before embedding", async () => {
    const { ctx } = makeCtx();

    await expect(
      handleQueryCall(request({ query: "test query", limit: -1 }), ctx)
    ).rejects.toThrow("limit must be an integer greater than 0");
    expect(getSingleEmbedding).not.toHaveBeenCalled();
  });

  test("propagates an embedding failure", async () => {
    const { ctx } = makeCtx();
    getSingleEmbedding.mockRejectedValue(
      new Error("Embedding generation failed")
    );

    await expect(
      handleQueryCall(request({ query: "test query" }), ctx)
    ).rejects.toThrow("Embedding generation failed");
  });

  test("propagates a vector store failure as an HttpsError", async () => {
    const { ctx, chain } = makeCtx();
    chain.get.mockRejectedValue(new Error("Query failed"));

    const err = await handleQueryCall(
      request({ query: "test query" }),
      ctx
    ).catch((e: unknown) => e);

    expect((err as { code: string }).code).toBe("unknown");
    expect((err as Error).message).toBe("Query failed");
  });
});

/** A minimal `DocumentSnapshot` stand-in backed by a plain object. */
function snapshot(data: Record<string, unknown> | null) {
  const set = vi.fn().mockResolvedValue(undefined);
  return {
    snap: {
      exists: data !== null,
      data: () => data ?? undefined,
      get: (field: string) => data?.[field],
      ref: { path: `${config.collectionPath}/doc-1`, set },
    },
    set,
  };
}

function writeEvent(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  const beforeSnap = snapshot(before);
  const afterSnap = snapshot(after);
  const event = {
    params: { docId: "doc-1" },
    data: { before: beforeSnap.snap, after: afterSnap.snap },
  } as unknown as VectorWriteEvent;
  return { event, set: afterSnap.set };
}

function embedCtx() {
  return { firestore: {}, config } as unknown as HandlerContext;
}

describe("handleEmbedOnWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  test("embeds a new document and marks it COMPLETED", async () => {
    const { event, set } = writeEvent(null, { input: "hello" });

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    expect(set).toHaveBeenCalledWith(
      {
        [config.outputFieldName]: FieldValue.vector(EMBEDDING),
        [config.statusFieldName]: { state: "COMPLETED" },
      },
      { merge: true }
    );
  });

  test("embeds a document that already has an embedding but no status", async () => {
    const { event } = writeEvent(null, {
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
    });

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  test("marks the document ERROR and rethrows when embedding fails", async () => {
    const { event, set } = writeEvent(null, { input: "hello" });
    getSingleEmbedding.mockRejectedValue(new Error("Embedding failed"));

    await expect(handleEmbedOnWrite(event, embedCtx())).rejects.toThrow(
      "Embedding failed"
    );
    expect(set).toHaveBeenCalledWith(
      {
        [config.statusFieldName]: {
          state: "ERROR",
          message: "Embedding failed",
        },
      },
      { merge: true }
    );
  });

  test("skips a deleted document", async () => {
    const { event, set } = writeEvent({ input: "hello" }, null);

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("skips a document whose input is not a string", async () => {
    const { event, set } = writeEvent(null, { input: 42 });

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  // Parity with the extension: `FirestoreOnWriteProcessor` skipped any document
  // already in a final state, so an edited input never produced a new embedding
  // and a failure was never retried.
  for (const state of ["PROCESSING", "COMPLETED", "ERROR", "BACKFILLED"]) {
    test(`does not re-embed a document in the ${state} state`, async () => {
      const { event, set } = writeEvent(
        { input: "hello", [config.statusFieldName]: { state } },
        { input: "goodbye", [config.statusFieldName]: { state } }
      );

      await handleEmbedOnWrite(event, embedCtx());

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    });
  }

  test("embeds a document in an unrecognised state", async () => {
    const { event } = writeEvent(null, {
      input: "hello",
      [config.statusFieldName]: { state: "SOMETHING_ELSE" },
    });

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  // The extension's skip rule was the status state alone, with no comparison
  // against the previous input, so an unchanged document with an embedding but
  // no status was still processed.
  test("embeds an unchanged document that has an embedding but no status", async () => {
    const doc = {
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
    };
    const { event } = writeEvent({ ...doc }, { ...doc });

    await handleEmbedOnWrite(event, embedCtx());

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  describe("with a custom status field name", () => {
    const customConfig = resolveVectorSearchConfig({
      projectId: "test-project",
      instanceId: "test-instance",
      statusFieldName: "embedStatus",
    });

    function customCtx() {
      return {
        firestore: {},
        config: customConfig,
      } as unknown as HandlerContext;
    }

    test("skips on the configured field", async () => {
      const { event, set } = writeEvent(null, {
        input: "hello",
        embedStatus: { state: "COMPLETED" },
      });

      await handleEmbedOnWrite(event, customCtx());

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    });

    test("ignores a terminal state on the default field", async () => {
      const { event } = writeEvent(null, {
        input: "hello",
        status: { state: "COMPLETED" },
      });

      await handleEmbedOnWrite(event, customCtx());

      expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    });
  });
});

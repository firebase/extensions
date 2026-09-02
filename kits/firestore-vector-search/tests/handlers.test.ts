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
  handleQueryCall,
  handleQueryOnWrite,
} from "../src/handlers";
import { resolveVectorSearchConfig } from "../src/export-config";

const config = resolveVectorSearchConfig({
  projectId: "test-project",
  instanceId: "test-instance",
});

const EMBEDDING = [0.1, 0.2, 0.3];
const IDS = ["doc-1", "doc-2"];

/** A HandlerContext whose Firestore returns `IDS` from any vector query. */
function makeCtx(ctxConfig = config) {
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
    config: ctxConfig,
  } as unknown as HandlerContext;
  return { ctx, collection, chain };
}

function request(data: unknown, auth: unknown = { uid: "test-user" }) {
  return { data, auth } as unknown as CallableRequest<unknown>;
}

function snapshot(data: Record<string, unknown> | undefined, set: unknown) {
  return {
    exists: data !== undefined,
    data: () => data,
    get: (field: string) => data?.[field],
    ref: { set, path: "test-collection/doc-1" },
  };
}

/**
 * A write event over the same document. Each snapshot gets its own set spy so
 * a write routed through `before.ref` cannot pass as one through `after.ref`.
 */
function writeEvent(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
) {
  const set = vi.fn();
  const beforeSet = vi.fn();
  const event = {
    data: { before: snapshot(before, beforeSet), after: snapshot(after, set) },
    params: {},
  } as unknown as VectorWriteEvent;
  return { event, set, beforeSet };
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

describe("handleQueryOnWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  /** The status record the handler stores alongside a completed result. */
  function completed(request: {
    query: string;
    limit?: unknown;
    prefilters?: unknown;
  }) {
    return {
      state: "COMPLETED",
      request: { limit: null, prefilters: null, ...request },
    };
  }

  test("runs the query and writes the result with its request record on create", async () => {
    const { ctx } = makeCtx();
    const { event, set, beforeSet } = writeEvent(undefined, {
      query: "test query",
    });

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "test query" }),
      },
      { merge: true }
    );
    expect(beforeSet).not.toHaveBeenCalled();
  });

  test("skips when the stored request matches and a result exists", async () => {
    const { ctx } = makeCtx();
    const doc = {
      query: "test query",
      result: { ids: IDS },
      [config.statusFieldName]: completed({ query: "test query" }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("skips the result-write echo", async () => {
    const { ctx } = makeCtx();
    const { event, set } = writeEvent(
      { query: "test query" },
      {
        query: "test query",
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "test query" }),
      }
    );

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("skips when stored query, limit, and prefilters all match", async () => {
    const { ctx } = makeCtx();
    const prefilters = [{ field: "category", operator: "==", value: "test" }];
    const doc = {
      query: "test query",
      limit: 5,
      prefilters,
      result: { ids: IDS },
      [config.statusFieldName]: completed({
        query: "test query",
        limit: 5,
        prefilters: [{ field: "category", operator: "==", value: "test" }],
      }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("skips when the matching stored limit is NaN", async () => {
    const { ctx } = makeCtx();
    const doc = {
      query: "test query",
      limit: Number.NaN,
      result: { ids: IDS },
      [config.statusFieldName]: completed({
        query: "test query",
        limit: Number.NaN,
      }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("re-runs the query when the limit differs from the stored request", async () => {
    const { ctx, chain } = makeCtx();
    const doc = {
      query: "test query",
      limit: 5,
      result: { ids: ["stale"] },
      [config.statusFieldName]: completed({ query: "test query", limit: 3 }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      { limit: 5, distanceMeasure: config.distanceMeasure }
    );
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "test query", limit: 5 }),
      },
      { merge: true }
    );
  });

  test("re-runs the query when the prefilters differ from the stored request", async () => {
    const { ctx, chain } = makeCtx();
    const doc = {
      query: "test query",
      prefilters: [{ field: "category", operator: "==", value: "new" }],
      result: { ids: ["stale"] },
      [config.statusFieldName]: completed({
        query: "test query",
        prefilters: [{ field: "category", operator: "==", value: "old" }],
      }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(chain.where).toHaveBeenCalledWith("category", "==", "new");
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({
          query: "test query",
          prefilters: [{ field: "category", operator: "==", value: "new" }],
        }),
      },
      { merge: true }
    );
  });

  test("re-runs the query when the query differs from the stored request", async () => {
    const { ctx } = makeCtx();
    const doc = {
      query: "new query",
      result: { ids: ["stale"] },
      [config.statusFieldName]: completed({ query: "old query" }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("new query");
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "new query" }),
      },
      { merge: true }
    );
  });

  test("re-runs the query when the result field is missing", async () => {
    const { ctx } = makeCtx();
    const doc = {
      query: "test query",
      [config.statusFieldName]: completed({ query: "test query" }),
    };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "test query" }),
      },
      { merge: true }
    );
  });

  test("re-runs once for a result without a stored request record", async () => {
    const { ctx } = makeCtx();
    const doc = { query: "test query", result: { ids: ["legacy"] } };
    const { event, set } = writeEvent(doc, doc);

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "test query" }),
      },
      { merge: true }
    );
  });

  test("a stale overwrite from a slow concurrent run self-heals, then stops", async () => {
    // Query A's late completion wrote A's result and A's request record onto
    // a document that already holds query B's inputs.
    const { ctx } = makeCtx();
    const staleDoc = {
      query: "query B",
      result: { ids: ["result A"] },
      [config.statusFieldName]: completed({ query: "query A" }),
    };
    const first = writeEvent(staleDoc, staleDoc);

    await handleQueryOnWrite(first.event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("query B");
    expect(first.set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        [config.statusFieldName]: completed({ query: "query B" }),
      },
      { merge: true }
    );

    // The corrective write echoes back as a new event; its record now
    // matches the document's inputs, so the loop terminates.
    const healedDoc = { ...staleDoc, ...first.set.mock.calls[0][0] };
    const second = writeEvent(staleDoc, healedDoc);
    getSingleEmbedding.mockClear();

    await handleQueryOnWrite(second.event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(second.set).not.toHaveBeenCalled();
  });

  test("ignores a document without a string query", async () => {
    const { ctx } = makeCtx();
    const { event, set } = writeEvent(
      { query: "test query", result: { ids: IDS } },
      { result: { ids: IDS } }
    );

    await handleQueryOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("stores the request record under a non-default statusFieldName and skips its echo", async () => {
    const customConfig = resolveVectorSearchConfig({
      projectId: "test-project",
      instanceId: "test-instance",
      statusFieldName: "vectorStatus",
    });
    const { ctx } = makeCtx(customConfig);
    const first = writeEvent(undefined, { query: "test query" });

    await handleQueryOnWrite(first.event, ctx);

    expect(first.set).toHaveBeenCalledWith(
      {
        result: { ids: IDS },
        vectorStatus: completed({ query: "test query" }),
      },
      { merge: true }
    );

    const echoDoc = { query: "test query", ...first.set.mock.calls[0][0] };
    const echo = writeEvent({ query: "test query" }, echoDoc);
    getSingleEmbedding.mockClear();

    await handleQueryOnWrite(echo.event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(echo.set).not.toHaveBeenCalled();
  });
});

describe("handleQueryOnWrite prefilters validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  test("runs the query and applies valid prefilters", async () => {
    const { ctx, chain } = makeCtx();
    const { event, set } = writeEvent(undefined, {
      query: "test query",
      prefilters: [{ field: "category", operator: "==", value: "test" }],
    });

    await handleQueryOnWrite(event, ctx);

    expect(chain.where).toHaveBeenCalledWith("category", "==", "test");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ result: { ids: IDS } }),
      { merge: true }
    );
  });

  test("rejects a non-array prefilters value before embedding", async () => {
    const { ctx } = makeCtx();
    const { event, set } = writeEvent(undefined, {
      query: "test query",
      prefilters: "not an array",
    });

    await expect(handleQueryOnWrite(event, ctx)).rejects.toThrow(
      /Invalid prefilters/
    );
    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("rejects a prefilter entry that is not an object", async () => {
    const { ctx } = makeCtx();
    const { event, set } = writeEvent(undefined, {
      query: "test query",
      prefilters: ["category == test"],
    });

    await expect(handleQueryOnWrite(event, ctx)).rejects.toThrow(
      /Invalid prefilters/
    );
    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  test("treats missing prefilters as no prefilters", async () => {
    const { ctx, chain } = makeCtx();
    const { event, set } = writeEvent(undefined, { query: "test query" });

    await handleQueryOnWrite(event, ctx);

    expect(chain.where).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ result: { ids: IDS } }),
      { merge: true }
    );
  });

  test("treats an explicit null prefilters as no prefilters", async () => {
    const { ctx, chain } = makeCtx();
    const { event, set } = writeEvent(undefined, {
      query: "test query",
      prefilters: null,
    });

    await handleQueryOnWrite(event, ctx);

    expect(chain.where).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ result: { ids: IDS } }),
      { merge: true }
    );
  });

  test("names the offending entry's index in the error", async () => {
    const { ctx } = makeCtx();
    const { event } = writeEvent(undefined, {
      query: "test query",
      prefilters: [{ field: "category", operator: "==", value: "test" }, 42],
    });

    await expect(handleQueryOnWrite(event, ctx)).rejects.toThrow(
      "Invalid prefilters: 1: Expected object, received number"
    );
  });
});

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

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { Request } from "firebase-functions/v2/tasks";
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
  type VectorTaskData,
  type VectorWriteEvent,
  handleBackfillTask,
  handleEmbedOnWrite,
  handleQueryCall,
  handleQueryOnWrite,
  handleUpdateTask,
} from "../src/handlers";
import { resolveVectorSearchConfig } from "../src/export-config";

const config = resolveVectorSearchConfig({
  projectId: "test-project",
  instanceId: "test-instance",
});

const EMBEDDING = [0.1, 0.2, 0.3];
const IDS = ["doc-1", "doc-2"];
/** Stands in for the Firestore create time the start event copies forward. */
const CREATE_TIME = Timestamp.fromMillis(1_700_000_000_000);

/**
 * The status the extension wrote, keyed by the process id (the instance id).
 * `resolveVectorSearchConfig` is called with `instanceId: "test-instance"`.
 */
function status(
  state: string,
  rest: Record<string, unknown> = {},
  statusFieldName = config.statusFieldName,
  instanceId = config.instanceId
) {
  return { [statusFieldName]: { [instanceId]: { state, ...rest } } };
}

/** The nested field path the handlers write each status leaf at. */
function statusFieldPath(leaf?: string, ctxConfig = config) {
  const segments = [ctxConfig.statusFieldName, ctxConfig.instanceId];
  return new FieldPath(...(leaf ? [...segments, leaf] : segments));
}

/** The `PROCESSING` start event the extension wrote before every embed. */
function startEvent(ctxConfig = config) {
  return [
    statusFieldPath(undefined, ctxConfig),
    {
      state: "PROCESSING",
      startTime: FieldValue.serverTimestamp(),
      createTime: CREATE_TIME,
      updateTime: FieldValue.serverTimestamp(),
    },
  ];
}

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

function snapshot(
  data: Record<string, unknown> | undefined,
  ref: Record<string, unknown>
) {
  return {
    exists: data !== undefined,
    createTime: CREATE_TIME,
    data: () => data,
    get: (field: string) => data?.[field],
    ref: { path: "test-collection/doc-1", ...ref },
  };
}

/**
 * A write event over the same document. Each snapshot gets its own write spies
 * so a write routed through `before.ref` cannot pass as one through
 * `after.ref`.
 */
function writeEvent(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
) {
  const set = vi.fn();
  const update = vi.fn();
  const beforeSet = vi.fn();
  const beforeUpdate = vi.fn();
  const event = {
    data: {
      before: snapshot(before, { set: beforeSet, update: beforeUpdate }),
      after: snapshot(after, { set, update }),
    },
    params: {},
  } as unknown as VectorWriteEvent;
  return { event, set, update, beforeSet, beforeUpdate };
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

describe("handleEmbedOnWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  // Parity with the extension's `writeStartEvent`/`writeCompletionEvent`: the
  // document is marked `PROCESSING` before the embed and `COMPLETED` after it,
  // both under the process id, and both writes touch only those fields.
  test("embeds a new document and marks it PROCESSING then COMPLETED", async () => {
    const { ctx } = makeCtx();
    const { event, update } = writeEvent(undefined, { input: "hello" });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    expect(update).toHaveBeenNthCalledWith(1, ...startEvent());
    expect(update).toHaveBeenNthCalledWith(
      2,
      config.outputFieldName,
      FieldValue.vector(EMBEDDING),
      statusFieldPath("state"),
      "COMPLETED",
      statusFieldPath("updateTime"),
      FieldValue.serverTimestamp(),
      statusFieldPath("completeTime"),
      FieldValue.serverTimestamp()
    );
  });

  // The extension carried `createTime` forward from the previous status so the
  // backfill's order field survived a re-embed.
  test("keeps an existing createTime in the start event", async () => {
    const { ctx } = makeCtx();
    const earlier = Timestamp.fromMillis(1_600_000_000_000);
    const { event, update } = writeEvent(
      { input: "hello" },
      {
        input: "goodbye",
        ...status("FAILED_BACKFILL", { createTime: earlier }),
      }
    );

    await handleEmbedOnWrite(event, ctx);

    expect(update).toHaveBeenNthCalledWith(1, statusFieldPath(), {
      state: "PROCESSING",
      startTime: FieldValue.serverTimestamp(),
      createTime: earlier,
      updateTime: FieldValue.serverTimestamp(),
    });
  });

  test("embeds a document that already has an embedding but no status", async () => {
    const { ctx } = makeCtx();
    const { event } = writeEvent(undefined, {
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
    });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  // Parity with the extension, which recorded the failure on the document and
  // returned: the error reached the logs, not the caller, and the state carried
  // no message.
  test("marks the document ERROR without rethrowing when embedding fails", async () => {
    const { ctx } = makeCtx();
    const { event, update } = writeEvent(undefined, { input: "hello" });
    getSingleEmbedding.mockRejectedValue(new Error("Embedding failed"));

    await expect(handleEmbedOnWrite(event, ctx)).resolves.toBeUndefined();

    expect(update).toHaveBeenNthCalledWith(
      2,
      statusFieldPath("state"),
      "ERROR",
      statusFieldPath("updateTime"),
      FieldValue.serverTimestamp()
    );
  });

  test("skips a deleted document", async () => {
    const { ctx } = makeCtx();
    const { event, update } = writeEvent({ input: "hello" }, undefined);

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("skips a document whose input is not a string", async () => {
    const { ctx } = makeCtx();
    const { event, update } = writeEvent(undefined, { input: 42 });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // Parity with the extension's `shouldProcess`, which required a truthy
  // string. An empty input must leave the document without a status, or the
  // terminal-state guard would skip it once the input is filled in.
  test("skips a document whose input is an empty string", async () => {
    const { ctx } = makeCtx();
    const { event, update } = writeEvent(undefined, { input: "" });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("embeds a document whose empty input is filled in later", async () => {
    const { ctx } = makeCtx();
    const { event: created, update: createdUpdate } = writeEvent(undefined, {
      input: "",
    });

    await handleEmbedOnWrite(created, ctx);

    expect(createdUpdate).not.toHaveBeenCalled();

    const { event: filled, update } = writeEvent(
      { input: "" },
      { input: "hello" }
    );

    await handleEmbedOnWrite(filled, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    expect(update).toHaveBeenNthCalledWith(
      2,
      config.outputFieldName,
      FieldValue.vector(EMBEDDING),
      statusFieldPath("state"),
      "COMPLETED",
      statusFieldPath("updateTime"),
      FieldValue.serverTimestamp(),
      statusFieldPath("completeTime"),
      FieldValue.serverTimestamp()
    );
  });

  // Parity with the extension: `FirestoreOnWriteProcessor` skipped any document
  // already in a final state, so an edited input never produced a new embedding
  // and a failure was never retried.
  for (const state of ["PROCESSING", "COMPLETED", "ERROR", "BACKFILLED"]) {
    test(`does not re-embed a document in the ${state} state`, async () => {
      const { ctx } = makeCtx();
      const { event, update } = writeEvent(
        { input: "hello", ...status(state) },
        { input: "goodbye", ...status(state) }
      );

      await handleEmbedOnWrite(event, ctx);

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  }

  // The extension's backfill handler wrote `FAILED_BACKFILL`, which its
  // `FirestoreOnWriteProcessor` did not treat as final.
  test("embeds a document in an unrecognised state", async () => {
    const { ctx } = makeCtx();
    const { event } = writeEvent(undefined, {
      input: "hello",
      ...status("FAILED_BACKFILL"),
    });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  // A status written by the extension is keyed by the process id, so a flat
  // `status.state` is not a state this handler recognises.
  test("ignores a state that is not under the instance id", async () => {
    const { ctx } = makeCtx();
    const { event } = writeEvent(undefined, {
      input: "hello",
      [config.statusFieldName]: { state: "COMPLETED" },
    });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  // Parity with the extension's `fieldDependencyArray: [inputField]`: a write
  // that leaves the input untouched was not processed, whatever else changed.
  test("skips an unchanged input", async () => {
    const { ctx } = makeCtx();
    const doc = {
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
    };
    const { event, update } = writeEvent(
      { ...doc },
      { ...doc, unrelated: "changed" }
    );

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("embeds a document whose input changed type", async () => {
    const { ctx } = makeCtx();
    const { event } = writeEvent({ input: 42 }, { input: "hello" });

    await handleEmbedOnWrite(event, ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  describe("with a custom status field name", () => {
    const customConfig = resolveVectorSearchConfig({
      projectId: "test-project",
      instanceId: "test-instance",
      statusFieldName: "embedStatus",
    });

    test("skips on the configured field", async () => {
      const { ctx } = makeCtx(customConfig);
      const { event, update } = writeEvent(undefined, {
        input: "hello",
        ...status("COMPLETED", {}, "embedStatus"),
      });

      await handleEmbedOnWrite(event, ctx);

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    test("writes the status on the configured field", async () => {
      const { ctx } = makeCtx(customConfig);
      const { event, update } = writeEvent(undefined, { input: "hello" });

      await handleEmbedOnWrite(event, ctx);

      expect(update).toHaveBeenNthCalledWith(1, ...startEvent(customConfig));
    });

    test("ignores a terminal state on the default field", async () => {
      const { ctx } = makeCtx(customConfig);
      const { event } = writeEvent(undefined, {
        input: "hello",
        ...status("COMPLETED", {}, "status"),
      });

      await handleEmbedOnWrite(event, ctx);

      expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    });
  });
});

describe("handleBackfillTask", () => {
  const PATH = "test-collection/doc-1";

  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  /** A HandlerContext whose Firestore returns `data` at any document path. */
  function backfillCtx(data: Record<string, unknown> | undefined) {
    const set = vi.fn();
    const update = vi.fn();
    const ref = {
      set,
      update,
      get: vi.fn(async () => snapshot(data, { set, update })),
    };
    const doc = vi.fn(() => ref);
    const ctx = { firestore: { doc }, config } as unknown as HandlerContext;
    return { ctx, set, update };
  }

  function task(docPath: string) {
    return { data: { path: docPath } } as unknown as Request<VectorTaskData>;
  }

  // Parity with the extension's backfill handler, which wrote `BACKFILLED` and
  // a `completeTime`, and no start event.
  test("embeds the document at the task's path", async () => {
    const { ctx, update } = backfillCtx({ input: "hello" });

    await handleBackfillTask(task(PATH), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    expect(update).toHaveBeenCalledWith(
      config.outputFieldName,
      FieldValue.vector(EMBEDDING),
      statusFieldPath("state"),
      "BACKFILLED",
      statusFieldPath("completeTime"),
      FieldValue.serverTimestamp()
    );
  });

  // Parity with the extension's `shouldBackfill`, which required a truthy
  // string. Writing a terminal status here would stop `embedOnWrite` embedding
  // the document once its input is filled in.
  test("skips a document whose input is an empty string", async () => {
    const { ctx, update } = backfillCtx({ input: "" });

    await handleBackfillTask(task(PATH), ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // Parity with the extension's `getValidDocs`: a document already carrying a
  // status was skipped unless that status was `BACKFILLED`.
  for (const state of ["PROCESSING", "COMPLETED", "ERROR", "FAILED_BACKFILL"]) {
    test(`skips a document in the ${state} state`, async () => {
      const { ctx, update } = backfillCtx({
        input: "hello",
        ...status(state),
      });

      await handleBackfillTask(task(PATH), ctx);

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  }

  test("re-embeds a document that was already backfilled", async () => {
    const { ctx } = backfillCtx({ input: "hello", ...status("BACKFILLED") });

    await handleBackfillTask(task(PATH), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
  });

  // Parity with the extension, which recorded the failure and returned rather
  // than throwing, so the task was not retried.
  test("marks the document FAILED_BACKFILL when embedding fails", async () => {
    const { ctx, update } = backfillCtx({ input: "hello" });
    getSingleEmbedding.mockRejectedValue(new Error("Embedding failed"));

    await expect(handleBackfillTask(task(PATH), ctx)).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith(
      statusFieldPath("state"),
      "FAILED_BACKFILL",
      statusFieldPath("completeTime"),
      FieldValue.serverTimestamp()
    );
  });
});

describe("handleUpdateTask", () => {
  const PATH = "test-collection/doc-1";

  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  function updateCtx(data: Record<string, unknown> | undefined) {
    const set = vi.fn();
    const update = vi.fn();
    const ref = {
      set,
      update,
      get: vi.fn(async () => snapshot(data, { set, update })),
    };
    const doc = vi.fn(() => ref);
    const ctx = { firestore: { doc }, config } as unknown as HandlerContext;
    return { ctx, update };
  }

  function task(docPath: string) {
    return { data: { path: docPath } } as unknown as Request<VectorTaskData>;
  }

  // Parity with the extension's `shouldUpdate`, which required both a truthy
  // string input and an existing embedding.
  test("skips a document with no existing embedding", async () => {
    const { ctx, update } = updateCtx({ input: "hello" });

    await handleUpdateTask(task(PATH), ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // The update pass shared the extension's backfill handler, so it skipped the
  // same documents and wrote the same state.
  test("skips a document embedOnWrite already completed", async () => {
    const { ctx, update } = updateCtx({
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
      ...status("COMPLETED"),
    });

    await handleUpdateTask(task(PATH), ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test("re-embeds a backfilled document and marks it BACKFILLED", async () => {
    const { ctx, update } = updateCtx({
      input: "hello",
      [config.outputFieldName]: FieldValue.vector(EMBEDDING),
      ...status("BACKFILLED"),
    });

    await handleUpdateTask(task(PATH), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("hello");
    expect(update).toHaveBeenCalledWith(
      config.outputFieldName,
      FieldValue.vector(EMBEDDING),
      statusFieldPath("state"),
      "BACKFILLED",
      statusFieldPath("completeTime"),
      FieldValue.serverTimestamp()
    );
  });
});

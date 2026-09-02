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

/**
 * A DocumentSnapshot stand-in. `undefined` data means the snapshot does not
 * exist, matching a create's `before` or a delete's `after`.
 */
function snapshot(
  data: Record<string, unknown> | undefined,
  createTime: unknown = "doc-create-time"
) {
  const update = vi.fn().mockResolvedValue(undefined);
  return {
    exists: data !== undefined,
    createTime,
    data: () => data,
    get: (path: string) =>
      path
        .split(".")
        .reduce<unknown>(
          (acc, key) =>
            acc == null ? undefined : (acc as Record<string, unknown>)[key],
          data
        ),
    ref: { path: "queries/query-1", update },
    update,
  };
}

function writeEvent(
  before: ReturnType<typeof snapshot>,
  after: ReturnType<typeof snapshot>
) {
  return {
    data: { before, after },
    params: { queryId: "query-1" },
  } as unknown as VectorWriteEvent;
}

const COMPLETED_STATUS = {
  status: { textQuery: { state: "COMPLETED" } },
};

describe("handleQueryOnWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
  });

  test("runs the query on create and writes the result with a status", async () => {
    const { ctx, chain } = makeCtx();
    const after = snapshot({ query: "test query" });

    await handleQueryOnWrite(writeEvent(snapshot(undefined), after), ctx);

    expect(getSingleEmbedding).toHaveBeenCalledWith("test query");
    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      {
        limit: config.defaultQueryLimit,
        distanceMeasure: config.distanceMeasure,
      }
    );
    expect(after.update).toHaveBeenCalledTimes(2);

    const start = after.update.mock.calls[0][0];
    expect(start["status.textQuery"]).toMatchObject({
      state: "PROCESSING",
      createTime: "doc-create-time",
    });
    expect(start["status.textQuery"].startTime).toBeDefined();
    expect(start["status.textQuery"].updateTime).toBeDefined();

    const complete = after.update.mock.calls[1][0];
    expect(complete.result).toEqual({ ids: IDS });
    expect(complete["status.textQuery.state"]).toBe("COMPLETED");
    expect(complete["status.textQuery.updateTime"]).toBeDefined();
    expect(complete["status.textQuery.completeTime"]).toBeDefined();
  });

  test("keeps an existing status order field across a re-run", async () => {
    const { ctx } = makeCtx();
    const after = snapshot({
      query: "second query",
      status: { textQuery: { createTime: "first-run-create-time" } },
    });

    await handleQueryOnWrite(
      writeEvent(snapshot({ query: "first query" }), after),
      ctx
    );

    expect(after.update.mock.calls[0][0]["status.textQuery"].createTime).toBe(
      "first-run-create-time"
    );
  });

  test("ignores the result write it makes itself", async () => {
    const { ctx } = makeCtx();
    const after = snapshot({
      query: "test query",
      result: { ids: IDS },
      ...COMPLETED_STATUS,
    });

    await handleQueryOnWrite(
      writeEvent(snapshot({ query: "test query" }), after),
      ctx
    );

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(after.update).not.toHaveBeenCalled();
  });

  test.each(["PROCESSING", "COMPLETED", "ERROR", "BACKFILLED"])(
    "never re-runs a document whose status is %s, even when the query changes",
    async (state) => {
      const { ctx } = makeCtx();
      const after = snapshot({
        query: "changed query",
        status: { textQuery: { state } },
      });

      await handleQueryOnWrite(
        writeEvent(snapshot({ query: "original query" }), after),
        ctx
      );

      expect(getSingleEmbedding).not.toHaveBeenCalled();
      expect(after.update).not.toHaveBeenCalled();
    }
  );

  test("ignores a write that changes neither the query nor the limit", async () => {
    const { ctx } = makeCtx();
    const after = snapshot({ query: "test query", unrelated: "b" });

    await handleQueryOnWrite(
      writeEvent(snapshot({ query: "test query", unrelated: "a" }), after),
      ctx
    );

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(after.update).not.toHaveBeenCalled();
  });

  test("runs when the limit changes on a document with no status", async () => {
    const { ctx, chain } = makeCtx();
    const after = snapshot({ query: "test query", limit: "5" });

    await handleQueryOnWrite(
      writeEvent(snapshot({ query: "test query", limit: "3" }), after),
      ctx
    );

    expect(chain.findNearest).toHaveBeenCalledWith(
      config.outputFieldName,
      EMBEDDING,
      { limit: 5, distanceMeasure: config.distanceMeasure }
    );
  });

  test("applies the document prefilters", async () => {
    const { ctx, chain } = makeCtx();
    const after = snapshot({
      query: "test query",
      prefilters: [{ field: "category", operator: "==", value: "test" }],
    });

    await handleQueryOnWrite(writeEvent(snapshot(undefined), after), ctx);

    expect(chain.where).toHaveBeenCalledWith("category", "==", "test");
  });

  test("marks the document ERROR and succeeds when the query fails", async () => {
    const { ctx } = makeCtx();
    getSingleEmbedding.mockRejectedValue(new Error("Embedding failed"));
    const after = snapshot({ query: "test query" });

    await expect(
      handleQueryOnWrite(writeEvent(snapshot(undefined), after), ctx)
    ).resolves.toBeUndefined();

    expect(after.update).toHaveBeenCalledTimes(2);
    const failure = after.update.mock.calls[1][0];
    expect(failure["status.textQuery.state"]).toBe("ERROR");
    expect(failure["status.textQuery.updateTime"]).toBeDefined();
    expect(failure.result).toBeUndefined();
  });

  test("propagates a failed result write instead of marking it ERROR", async () => {
    const { ctx } = makeCtx();
    const after = snapshot({ query: "test query" });
    after.update
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Document does not exist"));

    await expect(
      handleQueryOnWrite(writeEvent(snapshot(undefined), after), ctx)
    ).rejects.toThrow("Document does not exist");

    expect(after.update).toHaveBeenCalledTimes(2);
  });

  test("ignores a document without a string query", async () => {
    const { ctx } = makeCtx();
    const after = snapshot({ query: 42 });

    await handleQueryOnWrite(writeEvent(snapshot(undefined), after), ctx);

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(after.update).not.toHaveBeenCalled();
  });

  test("ignores a delete", async () => {
    const { ctx } = makeCtx();
    const after = snapshot(undefined);

    await handleQueryOnWrite(
      writeEvent(snapshot({ query: "test query" }), after),
      ctx
    );

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(after.update).not.toHaveBeenCalled();
  });
});

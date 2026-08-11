/*
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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveCaptureConfig } from "../src/capture-config";
import {
  type DocumentWriteEvent,
  getChangeType,
  handleChangelogTask,
  handleDocumentWrite,
  handleRestorationRequest,
  handleRestorationTask,
  type HandlerContext,
  isValidRestorationTimestamp,
} from "../src/handlers";

// Stubbed with a factory rather than automocked: automocking loads the real
// module, which pulls firebase-functions and firebase-admin into the test.
vi.mock("../src/logs", () => ({
  setLogLevel: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

/** Fake Firestore snapshot with only the fields the handlers read. */
function snap(exists: boolean, id: string, data: unknown = {}) {
  return { exists, id, data: () => data, ref: { path: `users/${id}` } };
}

function writeEvent(
  before: ReturnType<typeof snap>,
  after: ReturnType<typeof snap>
): DocumentWriteEvent {
  return {
    data: { before, after },
    id: "evt-1",
    time: "2026-01-01T00:00:00Z",
    document: "users/doc1",
    params: { documentId: "doc1" },
  } as unknown as DocumentWriteEvent;
}

function makeCtx(): HandlerContext {
  return {
    config: resolveCaptureConfig({
      projectId: "test-project",
      syncCollectionPath: "users",
      backupInstanceId: "backup-db",
      datasetId: "ds",
      tableId: "tbl",
    }),
    enqueueChangelogRow: vi.fn().mockResolvedValue(undefined),
    insertChangelogRows: vi.fn().mockResolvedValue(undefined),
    enqueueRestoration: vi.fn().mockResolvedValue(undefined),
    launchRestorationJob: vi
      .fn()
      .mockResolvedValue({ runId: "run-1", jobName: "job-1" }),
  };
}

describe("getChangeType", () => {
  test("classifies a create", () => {
    expect(
      getChangeType({
        before: snap(false, "d"),
        after: snap(true, "d"),
      } as never)
    ).toBe("CREATE");
  });

  test("classifies an update", () => {
    expect(
      getChangeType({
        before: snap(true, "d"),
        after: snap(true, "d"),
      } as never)
    ).toBe("UPDATE");
  });

  test("classifies a delete", () => {
    expect(
      getChangeType({
        before: snap(true, "d"),
        after: snap(false, "d"),
      } as never)
    ).toBe("DELETE");
  });
});

describe("handleDocumentWrite", () => {
  test("enqueues a serialized changelog row", async () => {
    const ctx = makeCtx();

    await handleDocumentWrite(
      writeEvent(snap(true, "doc1", { n: 1 }), snap(true, "doc1", { n: 2 })),
      ctx
    );

    expect(ctx.enqueueChangelogRow).toHaveBeenCalledTimes(1);
    expect(ctx.enqueueChangelogRow).toHaveBeenCalledWith({
      documentId: "doc1",
      documentPath: "users/doc1",
      beforeData: JSON.stringify({ n: { type: "number", value: 1 } }),
      afterData: JSON.stringify({ n: { type: "number", value: 2 } }),
      changeType: "UPDATE",
      timestamp: "2026-01-01T00:00:00Z",
    });
  });

  test("records a delete with empty after data", async () => {
    const ctx = makeCtx();

    await handleDocumentWrite(
      writeEvent(snap(true, "doc1", { n: 1 }), snap(false, "doc1", undefined)),
      ctx
    );

    const row = vi.mocked(ctx.enqueueChangelogRow).mock.calls[0][0];
    expect(row.changeType).toBe("DELETE");
    expect(row.afterData).toBe("{}");
  });

  test("ignores an event with no change payload", async () => {
    const ctx = makeCtx();

    await handleDocumentWrite({ data: undefined } as DocumentWriteEvent, ctx);

    expect(ctx.enqueueChangelogRow).not.toHaveBeenCalled();
  });
});

describe("handleChangelogTask", () => {
  test("inserts the queued row", async () => {
    const ctx = makeCtx();
    const row = {
      documentId: "doc1",
      documentPath: "users/doc1",
      beforeData: "{}",
      afterData: "{}",
      changeType: "CREATE" as const,
      timestamp: "2026-01-01T00:00:00Z",
    };

    await handleChangelogTask(row, ctx);

    expect(ctx.insertChangelogRows).toHaveBeenCalledWith([row]);
  });

  test("propagates an insert failure so the queue retries", async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.insertChangelogRows).mockRejectedValue(new Error("boom"));

    await expect(
      handleChangelogTask(
        {
          documentId: "doc1",
          documentPath: "users/doc1",
          beforeData: "{}",
          afterData: "{}",
          changeType: "CREATE",
          timestamp: "2026-01-01T00:00:00Z",
        },
        ctx
      )
    ).rejects.toThrow("boom");
  });
});

describe("isValidRestorationTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("accepts a past whole-second timestamp", () => {
    expect(isValidRestorationTimestamp(1700000000)).toBe(true);
  });

  test("accepts the current second", () => {
    expect(isValidRestorationTimestamp(Math.floor(Date.now() / 1000))).toBe(
      true
    );
  });

  test("rejects a future timestamp", () => {
    expect(isValidRestorationTimestamp(Math.floor(Date.now() / 1000) + 1)).toBe(
      false
    );
  });

  test("rejects a millisecond timestamp, which reads as the far future", () => {
    expect(isValidRestorationTimestamp(Date.now())).toBe(false);
  });

  test("rejects non-integers, zero and negatives", () => {
    expect(isValidRestorationTimestamp(1.5)).toBe(false);
    expect(isValidRestorationTimestamp(0)).toBe(false);
    expect(isValidRestorationTimestamp(-1)).toBe(false);
  });

  test("rejects non-numbers", () => {
    expect(isValidRestorationTimestamp("1700000000")).toBe(false);
    expect(isValidRestorationTimestamp(undefined)).toBe(false);
    expect(isValidRestorationTimestamp(null)).toBe(false);
  });
});

describe("handleRestorationRequest", () => {
  test("enqueues a valid request", async () => {
    const ctx = makeCtx();

    const result = await handleRestorationRequest(
      { timestamp: 1700000000 },
      ctx
    );

    expect(result).toEqual({ status: 200, body: "Restoration task enqueued" });
    expect(ctx.enqueueRestoration).toHaveBeenCalledWith({
      timestamp: 1700000000,
    });
  });

  test("rejects a missing timestamp with 400", async () => {
    const ctx = makeCtx();

    const result = await handleRestorationRequest({}, ctx);

    expect(result.status).toBe(400);
    expect(ctx.enqueueRestoration).not.toHaveBeenCalled();
  });

  test("rejects a future timestamp with 400", async () => {
    const ctx = makeCtx();

    const result = await handleRestorationRequest(
      { timestamp: Math.floor(Date.now() / 1000) + 3600 },
      ctx
    );

    expect(result.status).toBe(400);
    expect(ctx.enqueueRestoration).not.toHaveBeenCalled();
  });

  test("rejects a millisecond timestamp with 400", async () => {
    const ctx = makeCtx();

    const result = await handleRestorationRequest(
      { timestamp: Date.now() },
      ctx
    );

    expect(result.status).toBe(400);
    expect(ctx.enqueueRestoration).not.toHaveBeenCalled();
  });

  test("tolerates a null body", async () => {
    const ctx = makeCtx();

    expect((await handleRestorationRequest(null, ctx)).status).toBe(400);
  });
});

describe("handleRestorationTask", () => {
  test("launches the job for a valid request", async () => {
    const ctx = makeCtx();

    const job = await handleRestorationTask({ timestamp: 1700000000 }, ctx);

    expect(job).toEqual({ runId: "run-1", jobName: "job-1" });
    expect(ctx.launchRestorationJob).toHaveBeenCalledWith({
      timestamp: 1700000000,
    });
  });

  test("discards a task whose timestamp is invalid", async () => {
    const ctx = makeCtx();

    const job = await handleRestorationTask({ timestamp: -1 }, ctx);

    expect(job).toBeUndefined();
    expect(ctx.launchRestorationJob).not.toHaveBeenCalled();
  });
});

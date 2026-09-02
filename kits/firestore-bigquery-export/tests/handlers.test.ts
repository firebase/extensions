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

import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import type { Request } from "firebase-functions/tasks";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveExportConfig } from "../src/export-config";
import {
  type DocumentWriteEvent,
  type HandlerContext,
  type SerializedDocumentChange,
  handleDocumentWrite,
  handleSyncBigQueryTask,
} from "../src/handlers";

vi.mock("../src/events");
vi.mock("../src/logs");

import * as events from "../src/events";

/** Fake Firestore snapshot with only the fields the handlers read. */
function snap(exists: boolean, id: string, data: unknown = {}) {
  return { exists, id, data: () => data };
}

/** Fake document-write event. */
function writeEvent(
  before: ReturnType<typeof snap>,
  after: ReturnType<typeof snap>,
  overrides: Partial<Record<string, unknown>> = {}
): DocumentWriteEvent {
  return {
    data: { before, after },
    id: "evt-1",
    time: "2026-01-01T00:00:00Z",
    document: "users/doc1",
    params: { documentId: "doc1" },
    ...overrides,
  } as unknown as DocumentWriteEvent;
}

/** Builds a HandlerContext with spy tracker + config overrides. */
function makeCtx(
  configOverrides: Record<string, unknown> = {}
): HandlerContext {
  const tracker = {
    record: vi.fn().mockResolvedValue(undefined),
    serializeData: vi.fn((d: unknown) => d),
  };
  const config = {
    ...resolveExportConfig({
      collectionPath: "users",
      datasetId: "ds",
      tableId: "tbl",
      projectId: "test-project",
    }),
    ...configOverrides,
  };
  return {
    tracker: tracker as unknown as HandlerContext["tracker"],
    config: config as HandlerContext["config"],
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(undefined),
  };
}

/** Fake dispatched task request carrying a serialized change. */
function taskRequest(
  change: SerializedDocumentChange,
  retryCount = 0
): Request<SerializedDocumentChange> {
  return { data: change, retryCount } as Request<SerializedDocumentChange>;
}

/** A serialized change as it would arrive in a task payload. */
function serializedChange(
  overrides: Partial<SerializedDocumentChange> = {}
): SerializedDocumentChange {
  return {
    timestamp: "2026-01-01T00:00:00Z",
    eventId: "evt-1",
    fullResourceName:
      "projects/test-project/databases/(default)/documents/users/doc1",
    changeType: ChangeType.CREATE,
    documentId: "doc1",
    params: null,
    data: { a: 1 },
    oldData: undefined,
    ...overrides,
  };
}

describe("handleDocumentWrite", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns early when the event has no data", async () => {
    const ctx = makeCtx();
    await handleDocumentWrite({ data: undefined } as DocumentWriteEvent, ctx);
    expect(ctx.tracker.record).not.toHaveBeenCalled();
  });

  test("CREATE records the new data, no old data", async () => {
    const ctx = makeCtx();
    const event = writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 }));

    await handleDocumentWrite(event, ctx);

    expect(ctx.tracker.record).toHaveBeenCalledTimes(1);
    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(recorded[0].operation).toBe(ChangeType.CREATE);
    expect(recorded[0].data).toEqual({ a: 1 });
    expect(recorded[0].oldData).toBeUndefined();
    expect(events.recordStartEvent).toHaveBeenCalledTimes(1);
  });

  test("UPDATE includes old data by default", async () => {
    const ctx = makeCtx();
    const event = writeEvent(
      snap(true, "doc1", { a: 1 }),
      snap(true, "doc1", { a: 2 })
    );

    await handleDocumentWrite(event, ctx);

    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(recorded[0].operation).toBe(ChangeType.UPDATE);
    expect(recorded[0].data).toEqual({ a: 2 });
    expect(recorded[0].oldData).toEqual({ a: 1 });
  });

  test("excludeOldData omits the previous state on update", async () => {
    const ctx = makeCtx({ excludeOldData: true });
    const event = writeEvent(
      snap(true, "doc1", { a: 1 }),
      snap(true, "doc1", { a: 2 })
    );

    await handleDocumentWrite(event, ctx);

    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(recorded[0].oldData).toBeUndefined();
  });

  test("DELETE records no new data", async () => {
    const ctx = makeCtx();
    const event = writeEvent(snap(true, "doc1", { a: 1 }), snap(false, "doc1"));

    await handleDocumentWrite(event, ctx);

    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(recorded[0].operation).toBe(ChangeType.DELETE);
    expect(recorded[0].data).toBeUndefined();
  });

  test("does not provision on the hot path", async () => {
    const ctx = makeCtx();
    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      ctx
    );
    expect(ctx.ensureInitialized).not.toHaveBeenCalled();
  });

  test("wildcardIds gates whether path params are recorded", async () => {
    const withIds = makeCtx({ wildcardIds: true });
    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      withIds
    );
    const [[recordedWith]] = (
      withIds.tracker.record as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(recordedWith[0].pathParams).toEqual({ documentId: "doc1" });

    const withoutIds = makeCtx({ wildcardIds: false });
    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      withoutIds
    );
    const [[recordedWithout]] = (
      withoutIds.tracker.record as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(recordedWithout[0].pathParams).toBeNull();
  });

  test("a failed inline write buffers through the queue and the execution succeeds", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("bq down")
    );

    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      ctx
    );

    expect(ctx.tracker.record).toHaveBeenCalledTimes(1);
    expect(ctx.enqueue).toHaveBeenCalledTimes(1);
    expect(ctx.ensureInitialized).not.toHaveBeenCalled();
  });

  test("a successful inline write enqueues nothing", async () => {
    const ctx = makeCtx();

    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      ctx
    );

    expect(ctx.enqueue).not.toHaveBeenCalled();
  });

  test("the enqueued change equals what the inline path tried to write", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("bq down")
    );

    await handleDocumentWrite(
      writeEvent(snap(true, "doc1", { a: 1 }), snap(true, "doc1", { a: 2 })),
      ctx
    );

    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    const [[enqueued]] = (ctx.enqueue as ReturnType<typeof vi.fn>).mock.calls;
    expect(enqueued).toMatchObject({
      timestamp: recorded[0].timestamp,
      eventId: recorded[0].eventId,
      fullResourceName: recorded[0].documentName,
      changeType: recorded[0].operation,
      documentId: recorded[0].documentId,
      params: recorded[0].pathParams,
      data: recorded[0].data,
      oldData: recorded[0].oldData,
    });
    // The payload must survive the JSON round trip through Cloud Tasks.
    expect(JSON.parse(JSON.stringify(enqueued))).toEqual(enqueued);
  });

  test("a failed enqueue is recorded and rethrown, never swallowed", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("bq down")
    );
    (ctx.enqueue as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("tasks down")
    );

    await expect(
      handleDocumentWrite(
        writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
        ctx
      )
    ).rejects.toThrow("tasks down");
    expect(events.recordErrorEvent).toHaveBeenCalled();
  });

  test("rethrows when serialization fails", async () => {
    const ctx = makeCtx();
    (ctx.tracker.serializeData as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        throw new Error("bad data");
      }
    );

    await expect(
      handleDocumentWrite(
        writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
        ctx
      )
    ).rejects.toThrow("bad data");
    expect(ctx.tracker.record).not.toHaveBeenCalled();
  });
});

describe("handleSyncBigQueryTask", () => {
  beforeEach(() => vi.clearAllMocks());

  test("self-heals, records the buffered change, and emits a success event", async () => {
    const ctx = makeCtx();
    const change = serializedChange();

    await handleSyncBigQueryTask(taskRequest(change), ctx);

    expect(ctx.ensureInitialized).toHaveBeenCalledTimes(1);
    const [[recorded]] = (ctx.tracker.record as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(recorded[0]).toMatchObject({
      timestamp: change.timestamp,
      operation: change.changeType,
      documentName: change.fullResourceName,
      documentId: change.documentId,
      eventId: change.eventId,
      data: change.data,
    });
    expect(events.recordSuccessEvent).toHaveBeenCalledTimes(1);
    expect(ctx.enqueue).not.toHaveBeenCalled();
  });

  test("rethrows a failed write so Cloud Tasks retries", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("still down")
    );

    await expect(
      handleSyncBigQueryTask(taskRequest(serializedChange(), 2), ctx)
    ).rejects.toThrow("still down");
    expect(events.recordSuccessEvent).not.toHaveBeenCalled();
    // Re-enqueueing from the task would seed a trigger-queue loop; retries
    // belong to Cloud Tasks alone.
    expect(ctx.enqueue).not.toHaveBeenCalled();
  });

  test("rethrows a failed self-heal without attempting the write", async () => {
    const ctx = makeCtx();
    (ctx.ensureInitialized as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("no dataset")
    );

    await expect(
      handleSyncBigQueryTask(taskRequest(serializedChange()), ctx)
    ).rejects.toThrow("no dataset");
    expect(ctx.tracker.record).not.toHaveBeenCalled();
  });
});

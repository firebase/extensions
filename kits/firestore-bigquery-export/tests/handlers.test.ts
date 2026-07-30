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
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveExportConfig } from "../src/export-config";
import {
  type DocumentWriteEvent,
  type HandlerContext,
  handleDocumentWrite,
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

  test("self-heals and retries the write when the inline write fails", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("bq down")
    );

    await handleDocumentWrite(
      writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
      ctx
    );

    expect(ctx.ensureInitialized).toHaveBeenCalledTimes(1);
    expect(ctx.tracker.record).toHaveBeenCalledTimes(2);
  });

  test("rethrows when self-heal retry fails so runtime retry can replay", async () => {
    const ctx = makeCtx();
    (ctx.tracker.record as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("bq down"))
      .mockRejectedValueOnce(new Error("still down"));

    await expect(
      handleDocumentWrite(
        writeEvent(snap(false, "doc1"), snap(true, "doc1", { a: 1 })),
        ctx
      )
    ).rejects.toThrow("still down");
    expect(ctx.ensureInitialized).toHaveBeenCalledTimes(1);
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

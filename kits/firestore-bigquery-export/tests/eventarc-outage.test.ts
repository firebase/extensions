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

/**
 * The handler is driven with a real `../src/events` against an Eventarc
 * channel that rejects every publish, as a deleted channel does with
 * PERMISSION_DENIED. The export must still reach BigQuery.
 */

import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import type { Request } from "firebase-functions/tasks";
import { logger } from "firebase-functions";
import { beforeEach, expect, test, vi } from "vitest";

const publish = vi
  .fn()
  .mockRejectedValue(
    Object.assign(new Error("Permission denied"), { code: 403 })
  );

vi.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel: () => ({ publish }) }),
}));
vi.mock("../src/logs");

import * as events from "../src/events";
import { resolveExportConfig } from "../src/export-config";
import {
  type DocumentWriteEvent,
  type HandlerContext,
  type SerializedDocumentChange,
  handleDocumentWrite,
  handleSyncBigQueryTask,
} from "../src/handlers";

function snap(exists: boolean, id: string, data: unknown = {}) {
  return { exists, id, data: () => data };
}

function makeCtx(): HandlerContext {
  return {
    tracker: {
      record: vi.fn().mockResolvedValue(undefined),
      serializeData: vi.fn((d: unknown) => d),
    },
    config: resolveExportConfig({
      collectionPath: "users",
      datasetId: "ds",
      tableId: "tbl",
      projectId: "test-project",
    }),
  } as unknown as HandlerContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, "warn").mockImplementation(() => {});
  process.env.EVENTARC_CHANNEL = "projects/p/locations/l/channels/firebase";
  events.setupEventChannel();
});

test("a document write still exports when every Eventarc publish is denied", async () => {
  const ctx = makeCtx();
  const event = {
    data: { before: snap(false, "doc1"), after: snap(true, "doc1", { a: 1 }) },
    id: "evt-1",
    time: "2026-01-01T00:00:00Z",
    document: "users/doc1",
    params: { documentId: "doc1" },
  } as unknown as DocumentWriteEvent;

  await expect(handleDocumentWrite(event, ctx)).resolves.toBeUndefined();

  expect(publish).toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalled();
  const record = vi.mocked(ctx.tracker.record);
  expect(record).toHaveBeenCalledTimes(1);
  expect(record.mock.calls[0][0][0].operation).toBe(ChangeType.CREATE);
});

test("a dispatched task does not retry when the onSuccess publish is denied", async () => {
  const ctx = makeCtx();
  const change: SerializedDocumentChange = {
    timestamp: "2026-01-01T00:00:00Z",
    eventId: "evt-1",
    fullResourceName:
      "projects/test-project/databases/(default)/documents/users/doc1",
    changeType: ChangeType.CREATE,
    documentId: "doc1",
    params: null,
    data: { a: 1 },
    oldData: undefined,
  };
  const req = {
    data: change,
    retryCount: 0,
  } as Request<SerializedDocumentChange>;

  // A rethrow here would have Cloud Tasks retry the insert past the insertId
  // dedupe window and duplicate the row.
  await expect(handleSyncBigQueryTask(req, ctx)).resolves.toBeUndefined();

  expect(publish).toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalled();
  expect(vi.mocked(ctx.tracker.record)).toHaveBeenCalledTimes(1);
});

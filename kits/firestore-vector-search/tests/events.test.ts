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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The extension declares four event types in its `extension.yaml` and publishes
// none of them, so the kit must publish none either. These tests fail if event
// publishing is reintroduced on the embed path.

const { getSingleEmbedding } = vi.hoisted(() => ({
  getSingleEmbedding: vi.fn(),
}));

vi.mock("../src/embeddings", () => ({
  createEmbedClient: vi.fn(() => ({
    batchSize: 1,
    getEmbeddings: vi.fn(),
    getSingleEmbedding,
  })),
}));

vi.mock("../src/queries/setup", () => ({ createIndex: vi.fn() }));

// Records whether `firebase-admin/eventarc` ever enters the module graph. Vitest
// only evaluates this factory if something actually imports the module, so the
// flag catches a reintroduced `events.ts` even when no channel is configured and
// the publish helpers would return early.
const eventarc = vi.hoisted(() => ({ imported: false, publish: vi.fn() }));

vi.mock("firebase-admin/eventarc", () => {
  eventarc.imported = true;
  return {
    getEventarc: vi.fn(() => ({
      channel: vi.fn(() => ({ publish: eventarc.publish })),
    })),
  };
});

import { resolveVectorSearchConfig } from "../src/export-config";
import {
  type HandlerContext,
  handleEmbedOnWrite,
  type VectorWriteEvent,
} from "../src/handlers";

const config = resolveVectorSearchConfig({
  projectId: "test-project",
  instanceId: "test-instance",
});

const EMBEDDING = [0.1, 0.2, 0.3];

function makeCtx(): HandlerContext {
  return { firestore: {}, config } as unknown as HandlerContext;
}

/** A write event whose `after` holds `after` and whose `before` holds `before`. */
function writeEvent(
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null = null
) {
  const set = vi.fn().mockResolvedValue(undefined);
  const snapshot = (data: Record<string, unknown> | null) => ({
    exists: data !== null,
    data: () => data ?? undefined,
    get: (field: string) => (data ? data[field] : undefined),
    ref: { path: `${config.collectionPath}/doc-1`, set },
  });
  const event = {
    data: { after: snapshot(after), before: snapshot(before) },
    params: { docId: "doc-1" },
  } as unknown as VectorWriteEvent;
  return { event, set };
}

describe("event publishing", () => {
  beforeEach(() => {
    // `eventarc.imported` is deliberately never reset: the import it records
    // happens once, when the module graph loads, before any test body runs.
    eventarc.publish.mockClear();
    getSingleEmbedding.mockReset();
    getSingleEmbedding.mockResolvedValue(EMBEDDING);
    // Configured exactly as a user would to opt into events, so a reintroduced
    // publish path would be live rather than short-circuited.
    process.env.EVENTARC_CHANNEL = "locations/us-central1/channels/firebase";
    process.env.EXT_SELECTED_EVENTS = [
      "firebase.extensions.firestore-vector-search.v1.onStart",
      "firebase.extensions.firestore-vector-search.v1.onSuccess",
      "firebase.extensions.firestore-vector-search.v1.onError",
      "firebase.extensions.firestore-vector-search.v1.onCompletion",
    ].join(",");
  });

  afterEach(() => {
    delete process.env.EVENTARC_CHANNEL;
    delete process.env.EXT_SELECTED_EVENTS;
  });

  test("does not pull Eventarc into the handler module graph", () => {
    expect(eventarc.imported).toBe(false);
  });

  test("does not reach Eventarc when an embedding succeeds", async () => {
    const { event, set } = writeEvent({ [config.inputFieldName]: "hello" });

    await handleEmbedOnWrite(event, makeCtx());

    expect(set).toHaveBeenCalledTimes(1);
    expect(eventarc.imported).toBe(false);
    expect(eventarc.publish).not.toHaveBeenCalled();
  });

  test("does not reach Eventarc when an embedding fails", async () => {
    const { event, set } = writeEvent({ [config.inputFieldName]: "hello" });
    getSingleEmbedding.mockRejectedValue(new Error("Error with embedding"));

    await expect(handleEmbedOnWrite(event, makeCtx())).rejects.toThrow(
      "Error with embedding"
    );

    expect(set).toHaveBeenCalledTimes(1);
    expect(eventarc.imported).toBe(false);
    expect(eventarc.publish).not.toHaveBeenCalled();
  });

  test("does not reach Eventarc when the write is skipped", async () => {
    const unchanged = {
      [config.inputFieldName]: "hello",
      [config.outputFieldName]: [0.1],
    };
    const skipped = [
      writeEvent(null),
      writeEvent({ [config.inputFieldName]: 42 }),
      writeEvent(unchanged, { [config.inputFieldName]: "hello" }),
    ];

    for (const { event } of skipped) {
      await handleEmbedOnWrite(event, makeCtx());
    }

    expect(getSingleEmbedding).not.toHaveBeenCalled();
    expect(eventarc.imported).toBe(false);
    expect(eventarc.publish).not.toHaveBeenCalled();
  });
});

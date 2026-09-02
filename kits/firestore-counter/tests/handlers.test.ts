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

import { beforeEach, describe, expect, test, vi } from "vitest";

const aggregateOnce = vi.fn();
const aggregateContinuously = vi.fn();
const rescheduleWorkers = vi.fn();
const controllerCtor = vi.fn();
const workerRun = vi.fn();
const workerCtor = vi.fn();

vi.mock("../src/controller", async () => {
  const actual =
    await vi.importActual<typeof import("../src/controller")>(
      "../src/controller"
    );
  return {
    ControllerStatus: actual.ControllerStatus,
    ShardedCounterController: class {
      constructor(...args: any[]) {
        controllerCtor(...args);
      }
      aggregateOnce = aggregateOnce;
      aggregateContinuously = aggregateContinuously;
      rescheduleWorkers = rescheduleWorkers;
    },
  };
});

vi.mock("../src/worker", () => ({
  ShardedCounterWorker: class {
    constructor(...args: any[]) {
      workerCtor(...args);
    }
    run = workerRun;
  },
}));

vi.mock("../src/events");

import { ControllerStatus } from "../src/controller";
import * as events from "../src/events";
import { resolveCounterConfig } from "../src/export-config";
import {
  handleSchedule,
  handleShardWrite,
  handleWorker,
  SHARDS_COLLECTION_ID,
} from "../src/handlers";

const metadocRef = { path: "_firebase_ext_/sharded_counter" };
const firestore = { doc: vi.fn(() => metadocRef) } as any;

function makeCtx() {
  return {
    firestore,
    config: resolveCounterConfig({
      internalStatePath: "_firebase_ext_/sharded_counter",
      scheduleFrequencyMinutes: 1,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  aggregateOnce.mockResolvedValue(ControllerStatus.SUCCESS);
  aggregateContinuously.mockResolvedValue(undefined);
  rescheduleWorkers.mockResolvedValue(undefined);
  workerRun.mockResolvedValue(undefined);
});

describe("handleSchedule", () => {
  test("aggregates inline against the configured internal state doc", async () => {
    await handleSchedule({} as any, makeCtx());

    expect(firestore.doc).toHaveBeenCalledWith(
      "_firebase_ext_/sharded_counter"
    );
    expect(controllerCtor).toHaveBeenCalledWith(
      metadocRef,
      SHARDS_COLLECTION_ID
    );
    expect(aggregateOnce).toHaveBeenCalledWith({ start: "", end: "" }, 200);
    expect(rescheduleWorkers).not.toHaveBeenCalled();
  });

  test.each([
    ["workers running", ControllerStatus.WORKERS_RUNNING],
    ["too many shards", ControllerStatus.TOO_MANY_SHARDS],
    ["failure", ControllerStatus.FAILURE],
  ])("reschedules workers on %s", async (_label, status) => {
    aggregateOnce.mockResolvedValue(status);

    await handleSchedule({} as any, makeCtx());

    expect(rescheduleWorkers).toHaveBeenCalledTimes(1);
  });
});

describe("handleShardWrite", () => {
  test("aggregates continuously and records lifecycle events", async () => {
    const event = {
      id: "event-1",
      time: "2026-01-01T00:00:00.000Z",
      project: "demo-project",
      database: "(default)",
      document: "_firebase_ext_/sharded_counter",
      data: { after: { exists: true } },
      params: { shardId: "0000" },
    } as any;

    await handleShardWrite(event, makeCtx());

    // The extension published the 1st gen `{change, context}` payload, so the
    // kit rebuilds the same shape rather than exposing the 2nd gen event.
    const context = {
      eventId: "event-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "google.firestore.document.write",
      resource: {
        service: "firestore.googleapis.com",
        name: "projects/demo-project/databases/(default)/documents/_firebase_ext_/sharded_counter",
      },
      params: { shardId: "0000" },
    };

    expect(events.recordStartEvent).toHaveBeenCalledWith({
      change: event.data,
      context,
    });
    expect(aggregateContinuously).toHaveBeenCalledWith(
      { start: "", end: "" },
      200,
      60000
    );
    expect(events.recordCompletionEvent).toHaveBeenCalledWith({ context });
  });
});

describe("handleWorker", () => {
  test("runs a worker for the written metadata doc", async () => {
    const after = { exists: true, ref: { path: "state/workers/0000" } };

    await handleWorker({ data: { after } } as any);

    expect(workerCtor).toHaveBeenCalledWith(after, SHARDS_COLLECTION_ID);
    expect(workerRun).toHaveBeenCalledTimes(1);
  });

  test("ignores deletions of worker metadata docs", async () => {
    await handleWorker({ data: { after: { exists: false } } } as any);

    expect(workerCtor).not.toHaveBeenCalled();
    expect(workerRun).not.toHaveBeenCalled();
  });

  test("returns cleanly when the event has no data", async () => {
    await expect(handleWorker({} as any)).resolves.toBeUndefined();
    expect(workerRun).not.toHaveBeenCalled();
  });
});

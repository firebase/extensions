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

vi.mock("firebase-admin/functions", () => ({
  getFunctions: vi.fn(),
}));

import { getFunctions } from "firebase-admin/functions";
import type { SerializedDocumentChange } from "../src/handlers";
import { enqueueSyncTask, syncQueuePath } from "../src/tasks";

function makeChange(
  overrides: Partial<SerializedDocumentChange> = {}
): SerializedDocumentChange {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    eventId: "evt-1",
    fullResourceName: "projects/p/databases/(default)/documents/c/d",
    changeType: "CREATE",
    documentId: "d",
    params: null,
    data: { a: 1 },
    oldData: undefined,
    ...overrides,
  } as SerializedDocumentChange;
}

const ENV_KEYS = ["DATABASE_REGION", "FUNCTION_REGION"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("syncQueuePath", () => {
  test("derives the region from DATABASE_REGION, mapping multi-regions", () => {
    process.env.DATABASE_REGION = "nam5";
    expect(syncQueuePath()).toBe(
      "locations/us-central1/functions/syncBigQuery"
    );
  });

  test("passes a regional DATABASE_REGION through", () => {
    process.env.DATABASE_REGION = "europe-west2";
    expect(syncQueuePath()).toBe(
      "locations/europe-west2/functions/syncBigQuery"
    );
  });

  test("prefers the CLI-set FUNCTION_REGION, the region the function is deployed in", () => {
    // On a first interactive deploy the functions land in us-central1 while
    // DATABASE_REGION already names the target region; the queue is where
    // the functions are.
    process.env.FUNCTION_REGION = "us-central1";
    process.env.DATABASE_REGION = "europe-west2";
    expect(syncQueuePath()).toBe(
      "locations/us-central1/functions/syncBigQuery"
    );
  });

  test("falls back to DATABASE_REGION when FUNCTION_REGION is unset", () => {
    process.env.DATABASE_REGION = "europe-west2";
    expect(syncQueuePath()).toBe(
      "locations/europe-west2/functions/syncBigQuery"
    );
  });

  test("throws when neither region variable is set", () => {
    expect(() => syncQueuePath()).toThrow(/region/i);
  });

  test("throws when both region variables are empty strings", () => {
    process.env.DATABASE_REGION = "";
    process.env.FUNCTION_REGION = "";
    expect(() => syncQueuePath()).toThrow(/region/i);
  });
});

describe("enqueueSyncTask", () => {
  function mockQueue(enqueue: ReturnType<typeof vi.fn>) {
    const taskQueue = vi.fn(() => ({ enqueue }));
    vi.mocked(getFunctions).mockReturnValue({
      taskQueue,
    } as unknown as ReturnType<typeof getFunctions>);
    return taskQueue;
  }

  beforeEach(() => {
    process.env.DATABASE_REGION = "us-central1";
  });

  test("targets the bare function name; the admin SDK adds the kit prefix", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const taskQueue = mockQueue(enqueue);

    const change = makeChange();
    await enqueueSyncTask(change, 3);

    expect(taskQueue).toHaveBeenCalledWith(
      "locations/us-central1/functions/syncBigQuery"
    );
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(change, { id: "evt-1" });
  });

  test("derives the task id from the event id so a retry cannot double-buffer", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    mockQueue(enqueue);

    await enqueueSyncTask(makeChange({ eventId: "a/b:c d" }), 3);

    expect(enqueue).toHaveBeenCalledWith(expect.anything(), {
      id: "a-b-c-d",
    });
  });

  test("treats an already-enqueued task as success", async () => {
    const enqueue = vi.fn().mockRejectedValue(
      // Shaped like firebase-admin's PrefixedFirebaseError: `<prefix>/<code>`.
      Object.assign(new Error("exists"), {
        code: "functions/task-already-exists",
      })
    );
    mockQueue(enqueue);

    await expect(enqueueSyncTask(makeChange(), 3)).resolves.toBeUndefined();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test("a non-positive attempt budget still enqueues once", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    mockQueue(enqueue);

    await enqueueSyncTask(makeChange(), 0);

    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test("a NaN or non-integer attempt budget still enqueues once", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    mockQueue(enqueue);

    await enqueueSyncTask(makeChange(), NaN);
    await enqueueSyncTask(makeChange(), Infinity);

    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  test("retries a failed enqueue after a backoff and then succeeds", async () => {
    vi.useFakeTimers();
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(undefined);
    mockQueue(enqueue);

    const pending = enqueueSyncTask(makeChange(), 3);
    await vi.runAllTimersAsync();
    await pending;

    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  test("throws the last error once every attempt fails", async () => {
    vi.useFakeTimers();
    const enqueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValue(new Error("last"));
    mockQueue(enqueue);

    const pending = enqueueSyncTask(makeChange(), 3);
    // Attach the rejection expectation before advancing timers so the
    // rejection is never unhandled.
    const assertion = expect(pending).rejects.toThrow("last");
    await vi.runAllTimersAsync();
    await assertion;

    expect(enqueue).toHaveBeenCalledTimes(3);
  });
});

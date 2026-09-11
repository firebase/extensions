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

import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions/params", () => {
  throw new Error("./lib must not import firebase-functions/params");
});

describe("./lib", () => {
  test("imports without declaring Firebase params", async () => {
    const lib = await import("../src/lib");

    expect(lib.handleSchedule).toBeTypeOf("function");
    expect(lib.handleShardWrite).toBeTypeOf("function");
    expect(lib.handleWorker).toBeTypeOf("function");
    expect(lib.resolveCounterConfig).toBeTypeOf("function");
    expect(lib.scheduleExpression).toBeTypeOf("function");
    expect(lib.queryRange).toBeTypeOf("function");
    expect(lib.isUpdatedFrequently).toBeTypeOf("function");
    expect(lib.containsManyUpdates).toBeTypeOf("function");
    expect(lib.Aggregator).toBeTypeOf("function");
    expect(lib.NumericUpdate).toBeTypeOf("function");
    expect(lib.Planner).toBeTypeOf("function");
    expect(lib.ShardedCounterController).toBeTypeOf("function");
    expect(lib.ShardedCounterWorker).toBeTypeOf("function");
    expect(lib.SHARDS_COLLECTION_ID).toBe("_counter_shards_");
  }, 15000);
});

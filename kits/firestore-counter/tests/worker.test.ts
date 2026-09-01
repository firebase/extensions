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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/events");

import { ShardedCounterWorker } from "../src/worker";
import { FakeFirestore, SERVER_TIMESTAMP_MS } from "./fake-firestore";

const SHARDS_COLLECTION_ID = "_counter_shards_";

class WorkerTest extends ShardedCounterWorker {
  public static categorizeShards(
    shards: DocumentSnapshot[],
    singleRun: boolean
  ) {
    return super.categorizeShards(shards, singleRun);
  }

  public static cleanupPartials(db: any, toCleanup: DocumentSnapshot[]) {
    return super.cleanupPartials(db, toCleanup);
  }
}

let db: FakeFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  vi.clearAllMocks();
});

/**
 * Drives a worker to completion. Aggregation rounds are scheduled on a one
 * second interval and the worker always terminates by its 45s timeout, so
 * advancing past that guarantees the run settles.
 */
async function runWorker(worker: ShardedCounterWorker): Promise<void> {
  const run = worker.run();
  await vi.advanceTimersByTimeAsync(46_000);
  await run;
}

/** Seeds a worker metadata document covering the whole shard range. */
function seedMetadoc(slice = { start: "", end: "" }) {
  db.seed("test/worker", { slice, timestamp: 1 });
  return db.snapshot("test/worker");
}

describe("categorizeShards", () => {
  test("aggregates regular shards", () => {
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, { counter: 1 });
    const shard = db.snapshot(
      `test/counter1/${SHARDS_COLLECTION_ID}/012345678`
    );

    const [toAggregate, toCleanup] = WorkerTest.categorizeShards(
      [shard],
      false
    );

    expect(toAggregate).toEqual([shard]);
    expect(toCleanup).toEqual([]);
  });

  test("cleans up, but does not aggregate, empty partials", () => {
    db.seed(
      `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`,
      { _updates_: [{ _data_: { counter: 0 } }] },
      0 // stale, so it is not considered updated frequently
    );
    const partial = db.snapshot(
      `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`
    );

    const [toAggregate, toCleanup] = WorkerTest.categorizeShards(
      [partial],
      false
    );

    expect(toAggregate).toEqual([]);
    expect(toCleanup).toEqual([partial]);
  });

  test("leaves frequently updated empty partials alone outside single-run mode", () => {
    db.seed(
      `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`,
      { _updates_: [] },
      Math.floor(Date.now() / 1000)
    );
    const partial = db.snapshot(
      `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`
    );

    expect(WorkerTest.categorizeShards([partial], false)).toEqual([[], []]);
    // ...but a single run compacts them anyway.
    expect(WorkerTest.categorizeShards([partial], true)).toEqual([
      [],
      [partial],
    ]);
  });

  test("aggregates and compacts partials with many updates", () => {
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`, {
      _updates_: Array.from({ length: 11 }, () => ({
        _data_: { counter: 1 },
      })),
    });
    const partial = db.snapshot(
      `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`
    );

    const [toAggregate, toCleanup] = WorkerTest.categorizeShards(
      [partial],
      false
    );

    expect(toAggregate).toEqual([partial]);
    expect(toCleanup).toEqual([partial]);
  });
});

describe("cleanupPartials", () => {
  test("deletes empty partials", async () => {
    const path = `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`;
    db.seed(path, { _updates_: [{ _data_: { counter: 0 } }] });

    await Promise.all(WorkerTest.cleanupPartials(db, [db.snapshot(path)]));

    expect(db.snapshot(path).exists).toBe(false);
  });

  test("compacts partials that still hold a value", async () => {
    const path = `test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`;
    db.seed(path, {
      _updates_: [
        { _data_: { counter: 1 } },
        { _data_: { counter: 2 } },
        { _data_: { stats: { cnt: 3 } } },
      ],
    });

    await Promise.all(WorkerTest.cleanupPartials(db, [db.snapshot(path)]));

    const compacted = db.snapshot(path).data();
    expect(compacted._updates_).toHaveLength(1);
    expect(compacted._updates_[0]._data_).toEqual({
      counter: 3,
      stats: { cnt: 3 },
    });
    expect(typeof compacted._updates_[0]._id_).toBe("string");
  });
});

describe("run", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("can run a single aggregation", async () => {
    const metadoc = seedMetadoc();

    // Set up data for the first counter.
    db.seed("test/counter1", { stats: { cnt: 2 }, data: "hello world" });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`, {
      _updates_: [{ _data_: { stats: { cnt: 2 } } }],
    });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, {
      stats: { cnt: 1 },
    });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/123456789`, {
      stats: { cnt: 2 },
    });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/23456789a`, {
      stats: { cnt: 3 },
    });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/3456789ab`, {
      stats: { new: 5 },
    });

    // Set up data for the second counter, which does not exist yet.
    db.seed(`test/counter2/${SHARDS_COLLECTION_ID}/012345678`, {
      stats: { cnt: 1 },
    });
    db.seed(`test/counter2/${SHARDS_COLLECTION_ID}/123456789`, {
      stats: { cnt: 2 },
    });

    const worker = new ShardedCounterWorker(
      metadoc,
      SHARDS_COLLECTION_ID,
      true
    );
    await runWorker(worker);

    expect(db.snapshot("test/counter1").data()).toEqual({
      stats: { cnt: 10, new: 5 },
      data: "hello world",
    });
    expect(db.snapshot("test/counter2").data()).toEqual({
      stats: { cnt: 3 },
    });
  });

  test("aggregates only the shards inside its slice", async () => {
    const shardsPath = `test/counter1/${SHARDS_COLLECTION_ID}`;
    db.seed("test/counter1", { counter: 0 });
    db.seed(`${shardsPath}/00000000`, { counter: 1 });
    db.seed(`${shardsPath}/80000000`, { counter: 1 });

    // Slice covering only the second half of the range.
    const metadoc = seedMetadoc({
      start: `${shardsPath}/4`,
      end: "",
    });

    const worker = new ShardedCounterWorker(
      metadoc,
      SHARDS_COLLECTION_ID,
      true
    );
    await runWorker(worker);

    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 1 });
    expect(db.snapshot(`${shardsPath}/00000000`).exists).toBe(true);
    expect(db.snapshot(`${shardsPath}/80000000`).exists).toBe(false);
  });

  test("writes stats back to its metadata document", async () => {
    const metadoc = seedMetadoc();
    db.seed("test/counter1", { counter: 0 });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, { counter: 1 });

    const worker = new ShardedCounterWorker(
      metadoc,
      SHARDS_COLLECTION_ID,
      true
    );
    await runWorker(worker);

    const stats = db.snapshot("test/worker").data().stats;
    expect(stats.shardsAggregated).toBe(1);
    expect(stats.splits).toEqual([]);
    expect(stats.rounds).toBeGreaterThan(0);
    expect(stats.roundsCapped).toBe(0);
    expect(db.snapshot("test/worker").data().timestamp).toBe(
      SERVER_TIMESTAMP_MS
    );
  });

  test("shuts down without aggregating when its metadata changes", async () => {
    const metadoc = seedMetadoc();
    db.seed("test/counter1", { counter: 0 });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, { counter: 1 });

    const worker = new ShardedCounterWorker(
      metadoc,
      SHARDS_COLLECTION_ID,
      true
    );

    // Another controller run re-assigns the slice before the worker aggregates.
    db.seed("test/worker", {
      slice: { start: "", end: "" },
      timestamp: 2,
    });

    await runWorker(worker);

    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 0 });
    expect(
      db.snapshot(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`).exists
    ).toBe(true);
    expect(db.snapshot("test/worker").data().stats).toBeUndefined();
  });
});

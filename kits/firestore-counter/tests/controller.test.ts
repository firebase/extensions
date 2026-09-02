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

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/events");

import {
  ControllerStatus,
  ShardedCounterController as Controller,
  type WorkerShardingInfo,
} from "../src/controller";
import { FakeFirestore, SERVER_TIMESTAMP_MS } from "./fake-firestore";

const SHARDS_COLLECTION_ID = "_counter_shards_";

class ControllerTest extends Controller {
  public static balanceWorkers(workers: WorkerShardingInfo[]) {
    return super.balanceWorkers(workers);
  }
}

let db: FakeFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  vi.clearAllMocks();
});

describe("Controller", () => {
  test("can reshard workers", () => {
    const workers: WorkerShardingInfo[] = [
      {
        slice: {
          start: "00000000",
          end: "33333333",
        },
        hasData: true,
        overloaded: false,
        splits: ["11111111", "22222222"],
      },
      {
        slice: {
          start: "33333333",
          end: "66666666",
        },
        hasData: true,
        overloaded: false,
        splits: ["44444444", "55555555"],
      },
    ];
    const [reshard, slices] = ControllerTest.balanceWorkers(workers);
    expect(reshard).toBe(true);
    expect(slices).toEqual([{ start: "00000000", end: "66666666" }]);
  });

  test("reshards from scratch when there are no workers", () => {
    const [reshard, slices] = ControllerTest.balanceWorkers([]);
    expect(reshard).toBe(true);
    expect(slices).toEqual([{ start: "", end: "" }]);
  });

  test("waits for another round when a worker has no stats yet", () => {
    const [reshard, slices] = ControllerTest.balanceWorkers([
      {
        slice: { start: "", end: "" },
        hasData: false,
        overloaded: false,
        splits: [],
      },
    ]);
    expect(reshard).toBe(false);
    expect(slices).toEqual([]);
  });

  test("can aggregate shards", async () => {
    const controllerDocRef = db.doc("test/controller");
    db.seed("test/controller", { workers: [], timestamp: Date.now() });

    // Set up data for the first counter.
    db.seed("test/counter1", { stats: { cnt: 2 }, data: "hello world" });
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

    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    expect(status).toBe(ControllerStatus.SUCCESS);

    expect(db.snapshot("test/counter1").data()).toEqual({
      stats: { cnt: 8, new: 5 },
      data: "hello world",
    });
    expect(db.snapshot("test/counter2").data()).toEqual({
      stats: { cnt: 3 },
    });
  });

  test("deletes shards once they have been aggregated", async () => {
    db.seed("test/controller", { workers: [], timestamp: Date.now() });
    db.seed("test/counter1", { counter: 0 });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, { counter: 1 });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/123456789`, { counter: 1 });

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    await controller.aggregateOnce({ start: "", end: "" }, 200);

    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 2 });
    expect(
      db.snapshot(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`).exists
    ).toBe(false);
    expect(
      db.snapshot(`test/counter1/${SHARDS_COLLECTION_ID}/123456789`).exists
    ).toBe(false);
  });

  test("aggregates partial shards alongside regular shards", async () => {
    db.seed("test/controller", { workers: [], timestamp: Date.now() });
    db.seed("test/counter1", { stats: { cnt: 2 }, data: "hello world" });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/\t\t012`, {
      _updates_: [{ _data_: { stats: { cnt: 2 } } }],
    });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, {
      stats: { cnt: 1 },
    });

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);

    expect(status).toBe(ControllerStatus.SUCCESS);
    expect(db.snapshot("test/counter1").data()).toEqual({
      stats: { cnt: 5 },
      data: "hello world",
    });
  });

  test("can create the internal state document on its first run", async () => {
    const controllerDocRef = db.doc("test/controller");
    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );

    // on its first run the controller should create the controllerDocRef
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    expect(status).toBe(ControllerStatus.SUCCESS);

    expect(db.snapshot("test/controller").data()).toEqual({
      workers: [],
      timestamp: 0,
    });
  });

  test("does not aggregate while workers are running", async () => {
    db.seed("test/controller", {
      workers: [{ start: "", end: "" }],
      timestamp: Date.now(),
    });
    db.seed("test/counter1", { counter: 0 });
    db.seed(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`, { counter: 1 });

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);

    expect(status).toBe(ControllerStatus.WORKERS_RUNNING);
    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 0 });
    expect(
      db.snapshot(`test/counter1/${SHARDS_COLLECTION_ID}/012345678`).exists
    ).toBe(true);
  });

  test("bails out when there are too many shards to aggregate inline", async () => {
    db.seed("test/controller", { workers: [], timestamp: Date.now() });
    db.seed("test/counter1", { counter: 0 });
    for (let i = 0; i < 200; i++) {
      db.seed(
        `test/counter1/${SHARDS_COLLECTION_ID}/${i
          .toString()
          .padStart(9, "0")}`,
        { counter: 1 }
      );
    }

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);

    expect(status).toBe(ControllerStatus.TOO_MANY_SHARDS);
    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 0 });
  });

  test("reports failure when the transaction throws", async () => {
    db.seed("test/controller", { workers: [], timestamp: Date.now() });
    const controllerDocRef = db.doc("test/controller");
    vi.spyOn(db, "runTransaction").mockRejectedValueOnce(new Error("boom"));

    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );

    await expect(
      controller.aggregateOnce({ start: "", end: "" }, 200)
    ).resolves.toBe(ControllerStatus.FAILURE);
  });

  test("touches the controller timestamp after a successful run", async () => {
    db.seed("test/controller", { workers: [], timestamp: 1 });

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    await controller.aggregateOnce({ start: "", end: "" }, 200);

    expect(db.snapshot("test/controller").data()).toEqual({
      workers: [],
      timestamp: SERVER_TIMESTAMP_MS,
    });
  });
});

describe("rescheduleWorkers", () => {
  test("creates workers covering the whole range when none exist", async () => {
    db.seed("test/controller", { workers: [], timestamp: Date.now() });

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    await controller.rescheduleWorkers();

    expect(db.snapshot("test/controller").data()).toEqual({
      workers: [{ start: "", end: "" }],
      timestamp: SERVER_TIMESTAMP_MS,
    });
    expect(db.snapshot("test/controller/workers/0000").data()).toEqual({
      slice: { start: "", end: "" },
      timestamp: SERVER_TIMESTAMP_MS,
    });
  });

  test("keeps existing workers when they are still healthy", async () => {
    db.seed("test/controller", {
      workers: [{ start: "", end: "" }],
      timestamp: Date.now(),
    });
    db.seed(
      "test/controller/workers/0000",
      {
        slice: { start: "", end: "" },
        timestamp: Date.now(),
        stats: {
          lastSuccessfulRun: Date.now(),
          shardsAggregated: 300,
          splits: ["11111111", "22222222", "33333333"],
          rounds: 3,
          roundsCapped: 0,
        },
      },
      Math.floor(Date.now() / 1000)
    );

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    await controller.rescheduleWorkers();

    // Not resharded: the worker doc survives and the controller only bumps its
    // own timestamp.
    expect(db.snapshot("test/controller/workers/0000").exists).toBe(true);
    expect(db.snapshot("test/controller").data().workers).toEqual([
      { start: "", end: "" },
    ]);
    expect(db.snapshot("test/controller").data().timestamp).toBe(
      SERVER_TIMESTAMP_MS
    );
  });

  test("restarts workers that have not reported for over 90 seconds", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    db.seed("test/controller", {
      workers: [{ start: "", end: "" }],
      timestamp: Date.now(),
    });
    db.seed(
      "test/controller/workers/0000",
      {
        slice: { start: "", end: "" },
        timestamp: Date.now() - 120_000,
        stats: {
          lastSuccessfulRun: Date.now() - 120_000,
          shardsAggregated: 300,
          splits: ["11111111", "22222222", "33333333"],
          rounds: 3,
          roundsCapped: 0,
        },
      },
      nowSeconds - 120
    );

    const controller = new ControllerTest(
      db.doc("test/controller"),
      SHARDS_COLLECTION_ID
    );
    await controller.rescheduleWorkers();

    // The stale worker doc is touched so that its onWrite trigger fires again.
    expect(db.snapshot("test/controller/workers/0000").data().timestamp).toBe(
      SERVER_TIMESTAMP_MS
    );
  });
});

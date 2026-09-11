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

/**
 * End-to-end shape of the extension's `e2e.test.ts`: a client increments a
 * counter through its shard, reads a latency compensated value, and the
 * scheduled handler eventually aggregates the shards into the counter
 * document. The extension runs this against the Firestore emulator with the
 * functions deployed; the kit drives the same handlers directly against an
 * in-memory Firestore.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/events");

import { handleSchedule } from "../src/handlers";
import { FakeFirestore } from "./fake-firestore";
import { Counter } from "./test-client";

const INTERNAL_STATE_PATH = "_firebase_ext_/sharded_counter";

let db: FakeFirestore;

function ctx() {
  return {
    firestore: db as any,
    config: {
      internalStatePath: INTERNAL_STATE_PATH,
      scheduleFrequencyMinutes: 1,
    },
  };
}

/**
 * The very first controller run only creates the internal state document, so
 * aggregation always takes a second pass.
 */
async function runScheduledAggregation(times = 2) {
  for (let i = 0; i < times; i++) {
    await handleSchedule({} as any, ctx());
  }
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.clearAllMocks();
});

describe("sharded counter flow", () => {
  test("increments are latency compensated and aggregated eventually", async () => {
    const doc = db.doc("test/test");
    await doc.set({ counter: 0 });

    const counter = new Counter(doc, "counter");

    await counter.incrementBy(1);
    expect(await counter.get()).toBe(1);

    for (let i = 0; i < 300; i++) {
      await counter.incrementBy(1);
    }
    expect(await counter.get()).toBe(301);

    // The counter document itself has not been touched yet.
    expect(db.snapshot("test/test").data()).toEqual({ counter: 0 });

    await runScheduledAggregation();

    expect(db.snapshot("test/test").data()).toEqual({ counter: 301 });
    expect(await counter.get()).toBe(301);
    // The shard has been consumed.
    expect(db.snapshot(counter.shard().path).exists).toBe(false);
  });

  test("notifies snapshot listeners with the compensated value", async () => {
    const doc = db.doc("test/test");
    await doc.set({ counter: 0 });

    const counter = new Counter(doc, "counter");
    const observer = vi.fn();
    const unsubscribe = counter.onSnapshot(observer);

    await counter.incrementBy(5);
    await Promise.resolve();
    await runScheduledAggregation();
    await Promise.resolve();

    const values = observer.mock.calls.map(([snap]) => snap.data());
    expect(values.at(-1)).toBe(5);

    unsubscribe();
  });

  test("aggregates nested counter fields", async () => {
    const doc = db.doc("test/test");
    await doc.set({ stats: { views: 1 } });

    const counter = new Counter(doc, "stats.views");
    await counter.incrementBy(2);

    await runScheduledAggregation();

    expect(db.snapshot("test/test").data()).toEqual({ stats: { views: 3 } });
  });

  test("aggregates several counters in one run", async () => {
    const first = new Counter(db.doc("test/counter1"), "counter");
    const second = new Counter(db.doc("test/counter2"), "counter");

    await first.incrementBy(2);
    await second.incrementBy(3);

    await runScheduledAggregation();

    expect(db.snapshot("test/counter1").data()).toEqual({ counter: 2 });
    expect(db.snapshot("test/counter2").data()).toEqual({ counter: 3 });
  });
});

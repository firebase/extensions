/*
 * Copyright 2019 Google LLC
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

import * as admin from "firebase-admin";
import { ShardedCounterWorker } from "../src/worker";
import * as uuid from "uuid";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const app = admin.initializeApp();

const db = app.firestore();
db.settings({ timestampsInSnapshots: true });

function range(n: number) {
  return Array.from(Array(n).keys());
}

class StateTracker {
  private shardsUnsubscribe: () => void = null;
  private counterUnsubscribe: () => void = null;
  private logPromise: Promise<void> = null;
  private counterVal = 0;
  private partialSum = 0;
  private shardsSum = 0;
  constructor(private db: admin.firestore.Firestore) {}

  start(counterPath: string, collectionId: string) {
    this.shardsUnsubscribe = db
      .collectionGroup(collectionId)
      .onSnapshot((snap) => {
        this.scheduleLog();
        this.partialSum = 0;
        this.shardsSum = 0;
        snap.forEach((doc) => {
          if (doc.id.startsWith("\t")) {
            doc.data()._updates_.forEach((u) => {
              this.partialSum += u["_data_"]["counter"];
            });
          } else {
            this.shardsSum += doc.get("counter") || 0;
          }
        });
      });

    this.counterUnsubscribe = db.doc(counterPath).onSnapshot((snap) => {
      this.scheduleLog();
      this.counterVal = snap.get("counter") || 0;
    });
  }

  async stop() {
    this.shardsUnsubscribe();
    this.counterUnsubscribe();
    if (this.logPromise) await this.logPromise;
  }

  scheduleLog() {
    if (this.logPromise !== null) return;
    this.logPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        this.logPromise = null;
        resolve();
      }, 0);
    });
  }
}

describe("Worker", () => {
  test.skip("can run single aggregation", async () => {
    const SHARDS_COLLECTION_ID = uuid.v4();
    const TEST_PATH = uuid.v4();

    let metadocRef = db.collection(TEST_PATH).doc("worker");
    await metadocRef.set({
      slice: {
        start: "",
        end: "",
      },
      timestamp: Date.now(),
    });

    // Set up data for the first counter.
    let counterRef = db.collection(TEST_PATH).doc("counter1");
    await counterRef.set({ stats: { cnt: 2 }, data: "hello world" });
    let shardsRef = counterRef.collection(SHARDS_COLLECTION_ID);
    await shardsRef
      .doc("\t\t012")
      .set({ _updates_: [{ _data_: { stats: { cnt: 2 } } }] });
    await shardsRef.doc("012345678").set({ stats: { cnt: 1 } });
    await shardsRef.doc("123456789").set({ stats: { cnt: 2 } });
    await shardsRef.doc("23456789a").set({ stats: { cnt: 3 } });
    await shardsRef.doc("3456789ab").set({ stats: { new: 5 } });

    // Set up data for the second counter.
    let counter2Ref = db.collection(TEST_PATH).doc("counter2");
    let shards2Ref = counter2Ref.collection(SHARDS_COLLECTION_ID);
    await shards2Ref.doc("012345678").set({ stats: { cnt: 1 } });
    await shards2Ref.doc("123456789").set({ stats: { cnt: 2 } });

    let metadoc = await metadocRef.get();

    const worker = new ShardedCounterWorker(
      metadoc,
      SHARDS_COLLECTION_ID,
      true
    );
    await worker.run();

    let counter = await counterRef.get();
    expect(counter.data()).toEqual({
      stats: { cnt: 10, new: 5 },
      data: "hello world",
    });
    let counter2 = await counter2Ref.get();
    expect(counter2.data()).toEqual({
      stats: { cnt: 3 },
    });
    metadoc = await metadocRef.get();

    await metadocRef.delete();
    await counterRef.delete();
    await counter2Ref.delete();
  }, 12000);

  test.skip("can aggregate to counters", async () => {
    const SHARDS_COLLECTION_ID = uuid.v4();
    const TEST_PATH = uuid.v4();

    const tracker = new StateTracker(db);

    const metadocRef = db.collection(TEST_PATH).doc("worker");

    // Set up initial data.
    const counterRef = db.collection(TEST_PATH).doc("counter1");
    const shardsRef = counterRef.collection(SHARDS_COLLECTION_ID);
    const writes = range(2000).map(() => {
      return shardsRef.doc(uuid.v4()).set({ counter: 1 });
    });
    await Promise.all(writes);

    // Start tracker
    tracker.start(counterRef.path, SHARDS_COLLECTION_ID);

    let metadata = await metadocRef.set({
      slice: {
        start: shardsRef.path + "/80000000-0000-0000-0000-000000000000",
        end: "",
      },
      timestamp: Date.now(),
    });

    let metadoc = await metadocRef.get();

    let worker = new ShardedCounterWorker(metadoc, SHARDS_COLLECTION_ID, true);
    //(TODO) seems to be timing out:
    await worker.run();

    let counter = await counterRef.get();
    expect(counter.exists).toBe(false);

    await metadocRef.set({
      slice: {
        start: "",
        end: shardsRef.path + "/80000000-0000-0000-0000-000000000000",
      },
      timestamp: Date.now(),
    });

    metadoc = await metadocRef.get();
    worker = new ShardedCounterWorker(metadoc, SHARDS_COLLECTION_ID, true);
    await worker.run();

    counter = await counterRef.get();
    expect(counter.data()).toEqual({ counter: 2000 });

    await tracker.stop();
    await metadocRef.delete();
    await counterRef.delete();
  }, 12000);
});

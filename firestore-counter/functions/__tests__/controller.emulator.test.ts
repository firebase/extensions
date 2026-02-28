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

import {
  WorkerShardingInfo,
  ShardedCounterController as Controller,
  ControllerStatus,
} from "../src/controller";
import * as admin from "firebase-admin";
import * as uuid from "uuid";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

// let serviceAccount = require("../../test-project-key.json");

class ControllerTest extends Controller {
  public static balanceWorkers(workers: WorkerShardingInfo[]) {
    return super.balanceWorkers(workers);
  }
}

const app = admin.initializeApp();

const db = app.firestore();
db.settings({ timestampsInSnapshots: true });

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
          start: "3333333",
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

  // TODO: seems to be some assertion error
  test.skip("can aggregate shards", async () => {
    const SHARDS_COLLECTION_ID = uuid.v4();
    const TEST_PATH = uuid.v4();

    let controllerDocRef = db.collection(TEST_PATH).doc("controller");
    await controllerDocRef.set({
      workers: [],
      timestamp: Date.now(),
    });

    // Set up data for the first counter.
    let counterRef = db.collection(TEST_PATH).doc("counter1");
    await counterRef.set({ stats: { cnt: 2 }, data: "hello world" });
    let shardsRef = counterRef.collection(SHARDS_COLLECTION_ID);
    await shardsRef.doc("012345678").set({ stats: { cnt: 1 } });
    await shardsRef.doc("123456789").set({ stats: { cnt: 2 } });
    await shardsRef.doc("23456789a").set({ stats: { cnt: 3 } });
    await shardsRef.doc("3456789ab").set({ stats: { new: 5 } });

    // Set up data for the second counter.
    let counter2Ref = db.collection(TEST_PATH).doc("counter2");
    await counter2Ref.delete();
    let shards2Ref = counter2Ref.collection(SHARDS_COLLECTION_ID);
    await shards2Ref.doc("012345678").set({ stats: { cnt: 1 } });
    await shards2Ref.doc("123456789").set({ stats: { cnt: 2 } });

    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    expect(status).toBe(ControllerStatus.SUCCESS);

    const counter = await counterRef.get();
    expect(counter.data()).toEqual({
      stats: { cnt: 8, new: 5 },
      data: "hello world",
    });
    const counter2 = await counter2Ref.get();
    expect(counter2.data()).toEqual({
      stats: { cnt: 3 },
    });
    await controllerDocRef.delete();
    await counterRef.delete();
    await counter2Ref.delete();
  }, 10000);

  test("can create the internal state document on its first run", async () => {
    const SHARDS_COLLECTION_ID = uuid.v4();
    const TEST_PATH = uuid.v4();

    const controllerDocRef = db.collection(TEST_PATH).doc("controller");
    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );

    // on its first run the controller should create the controllerDocRef
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    expect(status).toBe(ControllerStatus.SUCCESS);

    const controllerDoc = await controllerDocRef.get();
    expect(controllerDoc.data()).toEqual({
      workers: [],
      timestamp: 0,
    });
    await controllerDocRef.delete();
  }, 10000);

  // TODO: timeout error
  test.skip("can continuously aggregate shards", async () => {
    const SHARDS_COLLECTION_ID = uuid.v4();
    const TEST_PATH = uuid.v4();

    let controllerDocRef = db.collection(TEST_PATH).doc("controller");
    await controllerDocRef.set({
      workers: [],
      timestamp: Date.now(),
    });

    // Set up data for the first counter.
    let counterRef = db.collection(TEST_PATH).doc("counter1");
    await counterRef.set({ stats: { cnt: 2 }, data: "hello world" });
    let shardsRef = counterRef.collection(SHARDS_COLLECTION_ID);
    await shardsRef.doc("012345678").set({ stats: { cnt: 1 } });
    await shardsRef.doc("123456789").set({ stats: { cnt: 2 } });
    await shardsRef.doc("23456789a").set({ stats: { cnt: 3 } });
    await shardsRef.doc("3456789ab").set({ stats: { new: 5 } });

    // Set up data for the second counter.
    let counter2Ref = db.collection(TEST_PATH).doc("counter2");
    await counter2Ref.delete();
    let shards2Ref = counter2Ref.collection(SHARDS_COLLECTION_ID);
    await shards2Ref.doc("012345678").set({ stats: { cnt: 1 } });
    await shards2Ref.doc("123456789").set({ stats: { cnt: 2 } });

    const controller = new ControllerTest(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );
    await controller.aggregateContinuously({ start: "", end: "" }, 200, 15000);

    const counter = await counterRef.get();
    expect(counter.data()).toEqual({
      stats: { cnt: 8, new: 5 },
      data: "hello world",
    });
    const counter2 = await counter2Ref.get();
    expect(counter2.data()).toEqual({
      stats: { cnt: 3 },
    });
    controllerDocRef.delete();
    counterRef.delete();
    counter2Ref.delete();
  }, 10000);
});

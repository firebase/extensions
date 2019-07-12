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

import { expect } from "chai";
import { suite, test, slow, timeout } from "mocha-typescript";

import {
  WorkerShardingInfo,
  ShardedCounterController,
  ControllerStatus,
} from "../src/controller";
import { initializeApp, credential } from "firebase-admin";
import * as uuid from "uuid";

let serviceAccount = require("../../test-project-key.json");

const app = initializeApp(
  {
    credential: credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  },
  "controller-test"
);

const db = app.firestore();
db.settings({ timestampsInSnapshots: true });

@suite
class ControllerTest extends ShardedCounterController {
  @test "can reshard workers"() {
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
    expect(reshard).to.be.equal(true);
    expect(slices).to.deep.equal([{ start: "00000000", end: "66666666" }]);
  }

  @test @timeout(10000) async "can aggregate shards"() {
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

    const controller = new ShardedCounterController(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );
    const status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    expect(status).to.be.equal(ControllerStatus.SUCCESS);

    const counter = await counterRef.get();
    expect(counter.data()).deep.equal({
      stats: { cnt: 8, new: 5 },
      data: "hello world",
    });
    const counter2 = await counter2Ref.get();
    expect(counter2.data()).deep.equal({
      stats: { cnt: 3 },
    });
    await controllerDocRef.delete();
    await counterRef.delete();
    await counter2Ref.delete();
  }

  @test @timeout(100000) async "can continuously aggregate shards"() {
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

    const controller = new ShardedCounterController(
      controllerDocRef,
      SHARDS_COLLECTION_ID
    );
    await controller.aggregateContinuously({ start: "", end: "" }, 200, 15000);

    const counter = await counterRef.get();
    expect(counter.data()).deep.equal({
      stats: { cnt: 8, new: 5 },
      data: "hello world",
    });
    const counter2 = await counter2Ref.get();
    expect(counter2.data()).deep.equal({
      stats: { cnt: 3 },
    });
    controllerDocRef.delete();
    counterRef.delete();
    counter2Ref.delete();
  }
}

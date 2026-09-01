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
 * Controller tests against a real Firestore emulator. The rest of the suite
 * runs on FakeFirestore, so these cover what a fake cannot: real transaction
 * read/write ordering and server-resolved timestamps.
 *
 * They are skipped unless FIRESTORE_EMULATOR_HOST is set.
 *
 * Run locally from kits/firestore-counter:
 *   npx firebase emulators:exec --only firestore -P demo-test \
 *     --config ../../_emulator/firebase.json "npx vitest run tests/integration"
 */

import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  ControllerStatus,
  ShardedCounterController,
} from "../../src/controller";

const runEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const describeEmulator = runEmulator ? describe : describe.skip;

let app: App;
let db: Firestore;

/** Deletes a document and every document under its subcollections. */
async function deleteRecursively(ref: DocumentReference): Promise<void> {
  const subcollections = await ref.listCollections();
  for (const subcollection of subcollections) {
    const docs = await subcollection.listDocuments();
    await Promise.all(docs.map((doc) => deleteRecursively(doc)));
  }
  await ref.delete();
}

describeEmulator("Controller (emulator)", () => {
  beforeAll(() => {
    app = initializeApp({ projectId: "demo-test" }, `counter-${randomUUID()}`);
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  test("can create the internal state document on its first run", async () => {
    const controllerDocRef = db.collection(randomUUID()).doc("controller");
    const controller = new ShardedCounterController(
      controllerDocRef,
      randomUUID()
    );

    try {
      const status = await controller.aggregateOnce(
        { start: "", end: "" },
        200
      );
      expect(status).toBe(ControllerStatus.SUCCESS);

      const controllerDoc = await controllerDocRef.get();
      expect(controllerDoc.data()).toEqual({ workers: [], timestamp: 0 });
    } finally {
      await deleteRecursively(controllerDocRef);
    }
  });

  test("reshards two under-loaded workers into a single slice", async () => {
    const controllerDocRef = db.collection(randomUUID()).doc("controller");
    const workersRef = controllerDocRef.collection("workers");
    const controller = new ShardedCounterController(
      controllerDocRef,
      randomUUID()
    );

    try {
      await controllerDocRef.set({
        workers: [
          { start: "00000000", end: "33333333" },
          { start: "3333333", end: "66666666" },
        ],
        timestamp: Date.now(),
      });
      await workersRef.doc("0000").set({
        slice: { start: "00000000", end: "33333333" },
        stats: {
          lastSuccessfulRun: Date.now(),
          shardsAggregated: 2,
          splits: ["11111111", "22222222"],
          rounds: 1,
          roundsCapped: 0,
        },
      });
      await workersRef.doc("0001").set({
        slice: { start: "3333333", end: "66666666" },
        stats: {
          lastSuccessfulRun: Date.now(),
          shardsAggregated: 2,
          splits: ["44444444", "55555555"],
          rounds: 1,
          roundsCapped: 0,
        },
      });

      await controller.rescheduleWorkers();

      const controllerDoc = await controllerDocRef.get();
      expect(controllerDoc.get("workers")).toEqual([
        { start: "00000000", end: "66666666" },
      ]);

      const workers = await workersRef.orderBy("__name__").get();
      expect(workers.docs.map((doc) => doc.id)).toEqual(["0000"]);
      expect(workers.docs[0].get("slice")).toEqual({
        start: "00000000",
        end: "66666666",
      });
    } finally {
      await deleteRecursively(controllerDocRef);
    }
  });
});

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

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ShardedCounterWorker } from "./worker";
import { ShardedCounterController, ControllerStatus } from "./controller";

admin.initializeApp();
const firestore = admin.firestore();
firestore.settings({ timestampsInSnapshots: true });

const SHARDS_COLLECTION_ID = "_counter_shards_";

/**
 * The controllerCore is scheduled to run automatically. It tries to aggregate shards if
 * there's less than 200 of them. Otherwise it is scheduling and monitoring
 * workers to do the aggregation.
 */
export const controllerCore = functions.handler.pubsub.schedule.onRun(
  async () => {
    const metadocRef = firestore.doc(process.env.INTERNAL_STATE_PATH);
    const controller = new ShardedCounterController(
      metadocRef,
      SHARDS_COLLECTION_ID
    );
    let status = await controller.aggregateOnce({ start: "", end: "" }, 200);
    if (
      status === ControllerStatus.WORKERS_RUNNING ||
      status === ControllerStatus.TOO_MANY_SHARDS ||
      status === ControllerStatus.FAILURE
    ) {
      await controller.rescheduleWorkers();
    }
    return null;
  }
);

/**
 * Worker is responsible for aggregation of a defined range of shards. It is controlled
 * by a worker metadata document. At the end of its run (that lasts for 45s) it writes
 * back stats that kicks off another run at the same time.
 *
 * ControllerCore is monitoring these metadata documents to detect overload that requires
 * resharding and to detect failed workers that need poking.
 */
export const worker = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    // stop worker if document got deleted
    if (!change.after.exists) return;

    const worker = new ShardedCounterWorker(change.after, SHARDS_COLLECTION_ID);
    await worker.run();
  }
);

/**
 * This is an additional function that is triggered for every shard write. It is
 * limited to one concurrent run at the time. This helps reduce latency for workloads
 * that are below the threshold for workers.
 */
export const onWrite = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    const metadocRef = firestore.doc(process.env.INTERNAL_STATE_PATH);
    const controller = new ShardedCounterController(
      metadocRef,
      SHARDS_COLLECTION_ID
    );
    await controller.aggregateContinuously({ start: "", end: "" }, 200, 60000);
  }
);

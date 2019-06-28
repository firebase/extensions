/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { initializeApp, credential } from "firebase-admin";
import * as uuid from "uuid";

let serviceAccount = require("../../test-project-key.json");

const app = initializeApp({
  credential: credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = app.firestore();

function range(n: number) {
  return Array.from(Array(n).keys());
}

async function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let i = 0; i < 100000; i++) {
    const timestamp = Date.now();
    const batch = db.batch();
    range(100).forEach(() => {
      const taskRef = db.collection("stress_test_queue").doc(uuid.v4());
      const taskInfo = {
        docs: range(10).map(() => {
          return {
            path: "stress_test/counter/_counter_shards_/" + uuid.v4(),
            object: { counter: 1 }
          };
        })
      }
      batch.set(taskRef, taskInfo);
    })
    await batch.commit();
    console.log("Scheduled 1000 increments to counter: " + i);
    const sleepTime = timestamp + 1000 - Date.now();
    if (sleepTime > 0) await delay(sleepTime);
  }
}

main();

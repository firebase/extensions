/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import * as functions from "firebase-functions";

interface TaskDoc {
  path: string;
  object: { [key: string]: any };
}

interface TaskInfo {
  docs: TaskDoc[];
}

export const stressTestRunner = functions.firestore
  .document("stress_test_queue/{taskId}")
  .onCreate(async (snap, context) => {
    const db = snap.ref.firestore;
    let done = false;
    while (!done) {
      done = await db.runTransaction(async (t) => {
        const task = await t.get(snap.ref);
        if (!task.exists) return true;
        const taskInfo = <TaskInfo>task.data();
        const doc = taskInfo.docs.pop();
        if (doc) t.set(db.doc(doc.path), doc.object);
        if (taskInfo.docs.length > 0) {
          t.set(snap.ref, taskInfo);
          return false;
        } else {
          t.delete(snap.ref);
          return true;
        }
      });
    }
  });

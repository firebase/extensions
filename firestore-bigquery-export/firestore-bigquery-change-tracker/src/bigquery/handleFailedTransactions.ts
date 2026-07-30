/**
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

import * as admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ChangeTrackerConfig } from ".";

if (!admin.apps.length) {
  initializeApp();
}

export default async (
  rows: any[],
  config: ChangeTrackerConfig,
  e: Error
): Promise<void> => {
  const db = getFirestore(config.firestoreInstanceId!);
  db.settings({
    ignoreUndefinedProperties: true,
  });
  const batchArray = [db.batch()];

  let operationCounter = 0;
  let batchIndex = 0;

  rows?.forEach((row) => {
    var ref = db.collection(config.backupTableId).doc(row.insertId);

    batchArray[batchIndex].set(ref, {
      ...row,
      error_details: e.message,
    });

    operationCounter++;

    // Check if max limit for batch has been met.
    if (operationCounter === 499) {
      batchArray.push(db.batch());
      batchIndex++;
      operationCounter = 0;
    }
  });

  for (let batch of batchArray) {
    await batch.commit();
  }

  return Promise.resolve();
};

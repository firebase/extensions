import * as admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

if (!admin.apps.length) {
  initializeApp();
}

export default async (
  rows: any[],
  config: FirestoreBigQueryEventHistoryTrackerConfig,
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

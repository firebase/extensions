import * as firebase from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";

if (!firebase.apps.length) {
  firebase.initializeApp();
  firebase.firestore().settings({ ignoreUndefinedProperties: true });
}

export default async (
  rows: any[],
  config: FirestoreBigQueryEventHistoryTrackerConfig,
  e: Error
): Promise<void> => {
  const db = getFirestore();
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

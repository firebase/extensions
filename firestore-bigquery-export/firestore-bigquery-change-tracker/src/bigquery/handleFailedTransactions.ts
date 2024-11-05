import * as firebase from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { FirestoreBigQueryEventHistoryTrackerConfig } from ".";
import * as logs from "../logs";

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

  logs.emergencyDebugChangetracker("Starting backup process", {
    rowsCount: rows?.length,
    backupTableId: config.backupTableId,
    errorMessage: e.message,
  });

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
      logs.emergencyDebugChangetracker("Created new batch due to limit", {
        currentBatchIndex: batchIndex,
      });
    }
  });

  for (let i = 0; i < batchArray.length; i++) {
    const batch = batchArray[i];
    try {
      await batch.commit();
      logs.emergencyDebugChangetracker("Committed batch successfully", {
        batchIndex: i,
      });
    } catch (commitError) {
      logs.emergencyDebugChangetracker("Error committing batch", {
        batchIndex: i,
        error: commitError.message,
      });
    }
  }

  return Promise.resolve();
};

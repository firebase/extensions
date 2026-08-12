import * as admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ChangeTrackerConfig } from ".";

if (!admin.apps.length) {
  initializeApp();
}

/**
 * Firestore instances whose `settings()` call has already been attempted.
 *
 * `getFirestore` returns one instance per database id, and `settings()` may only
 * be called once on it, before it is used. Calling it on every failed batch
 * therefore threw on every call after the first, so only the first failure in an
 * instance's lifetime was ever backed up.
 */
const settingsApplied = new Set<string>();

function backupFirestore(instanceId: string) {
  const db = getFirestore(instanceId);

  if (!settingsApplied.has(instanceId)) {
    settingsApplied.add(instanceId);

    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (settingsError) {
      // Something else in the process reached this instance first. The backup
      // still goes ahead, but an undefined value in a row will now throw from
      // `set()` instead of being skipped.
    }
  }

  return db;
}

export default async (
  rows: any[],
  config: ChangeTrackerConfig,
  e: Error
): Promise<void> => {
  const db = backupFirestore(config.firestoreInstanceId!);
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

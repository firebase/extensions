/**
 * Copyright 2023 Google LLC
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

import { logger } from "firebase-functions/v1";

import { launchJob } from "../dataflow/trigger_dataflow_job";

export const onBackupRestoreHandler = async (data: any) => {
  const timestamp = data.timestamp as number;

  if (!isValidUnixTimestamp(timestamp)) {
    logger.error(
      '"timestamp" field is missing, please ensure that you are sending a valid timestamp in the request body, is in seconds since epoch and is not in the future.'
    );
    return Promise.resolve();
  }

  logger.info(`Running backup restoration at PIT ${timestamp}`);

  // const importDoc = await db
  //   .doc(config.backupDoc)
  //   .collection('imports')
  //   .add({});

  // // Get the latest backup collection
  // const backupExportsCollection = db
  //   .doc(config.backupDoc)
  //   .collection('exports');

  // const completedExports = await backupExportsCollection
  //   .where('status', '==', 'Completed')
  //   .get();

  // const documents = completedExports.docs.map(doc => ({
  //   id: doc.id,
  //   data: doc.data(),
  // }));

  // // Sort documents by timestamp in descending order
  // const sortedDocuments = documents.sort(
  //   (a, b) => b.data.timestamp.toDate() - a.data.timestamp.toDate()
  // );

  // Get the most recent document
  // const doc = sortedDocuments.length > 0 ? sortedDocuments[0] : null;

  //TODO: use this version in the future, index creation is needed.
  // const backupDocuments = await db
  //   .doc(config.backupDoc)
  //   .collection('exports')
  //   .where('status', '==', 'Completed')
  //   .orderBy('timestamp', 'desc')
  //   .limit(1)
  //   .get();

  // Get the latest backup
  // const backupId = doc?.id;

  // // If no backup
  // if (!backupId) {
  //   logger.info('No backup found');
  //   return Promise.resolve();
  // }

  try {
    // // Export the Firestore db to storage
    // const {id, operation} = await createImport(backupId);

    // // Update Firestore for tracking
    // await importDoc.set({
    //   id,
    //   status: 'Running import...',
    //   operation: operation.name,
    //   timestamp: FieldValue.serverTimestamp(),
    // });

    // // Wait for import completion
    // await waitForImportCompletion(operation.name || '');

    // await importDoc.set({
    //   id,
    //   status: 'Initial backup restored, replaying final updates...',
    //   operation: operation.name,
    //   timestamp: FieldValue.serverTimestamp(),
    // });

    // Run DataFLow updates
    await launchJob(timestamp);

    // await importDoc.set({
    //   id,
    //   status: 'Completed',
    //   operation: operation.name,
    //   timestamp: FieldValue.serverTimestamp(),
    // });
  } catch (ex: any) {
    logger.error("Error restoring backup", ex);

    // await db.doc(config.backupDoc).collection('exports').add({
    //   error: ex.message,
    //   status: 'Failed',
    //   timestamp: FieldValue.serverTimestamp(),
    // });

    return Promise.resolve();
  }
};

/**
 * Checks if a long integer is a valid UNIX timestamp in seconds.
 *
 * @param timestamp The timestamp to check.
 * @returns Whether the timestamp is valid.
 */
function isValidUnixTimestamp(timestamp: number): boolean {
  // Ensure it's a non-negative integer
  if (!timestamp || timestamp < 0 || !Number.isInteger(timestamp)) {
    return false;
  }

  // Get the current UNIX timestamp
  const currentTimestamp: number = Math.floor(Date.now() / 1000);

  // Ensure the timestamp isn't in the future
  if (timestamp > currentTimestamp) {
    return false;
  }

  return true;
}

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import config from './config';
import * as logs from './logs';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

admin.initializeApp();
const NUM_RETRIES = 20;
enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

/**
 * Handler that listens to the document in RTDB containing user/session
 * information. The function calls the correct handler (upserts/deletes).
 *
 * The mod does not handle stale session deletes
 */
export const writeToFirestore =
    functions.handler.database.ref.onWrite(async (change, context) => {
      logs.start();
      try {
        const changeType = getChangeType(change);
        const userInfo = getUserAndSessionID(context.resource.name);
        const operationTimestamp = Date.parse(context.timestamp);
        const path = `${config.firestore_path}/${userInfo['userID']}/sessions/${userInfo['sessionID']}`;

        switch (changeType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            const payload = JSON.parse(JSON.stringify(change.after.val()));
            logs.handleUpsert(path, payload)
            await firestoreTransaction(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
            break;
          case ChangeType.DELETE:
            logs.handleDelete(path);
            await firestoreTransaction(admin.firestore.FieldValue.delete(), operationTimestamp, userInfo['userID'], userInfo['sessionID']);
            break;
          default:
            logs.error(new Error(`Invalid change type: ${changeType}`));
        }
        logs.success();
      } catch (err) {
        logs.error(err);
      }
    });

/**
 * Returns the operation performed on the document based on the before/after
 * data snapshot
 * @param change: the before/after datasnapshot
 */
const getChangeType = (change: functions.Change<admin.database.DataSnapshot>): ChangeType => {
  if (!change.after.exists()) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists()) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

/**
 * Grab the User and Session ID information from the RTDB path. Assumes {userID}/sessions/{sessionID} schema
 * @param path of the function trigger
 */
const getUserAndSessionID = (path: string) => {
  logs.getSessionInfo(path);
  const strArr = path.split('/');
  if (strArr.length < 3) {
    throw new Error(
        'Base path has incorrect number of subdirectories (should not happen).');
  }
  return {
    'userID': strArr[strArr.length - 3],
    'sessionID': strArr[strArr.length - 1],
  };
};

/**
 * Performs an optimistic transaction at the docRef given the operation timestamp is more recent
 * than the most recent operation applied at the destination. The function logic will try up to
 * NUM_RETRIES times if the following occur:
 *      1: Document Creation failed and document doesn't exist
 *      2: Document update fails preconditions
 *
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransaction = async (payload: any, operationTimestamp: number, userID: string, sessionID: string): Promise<void> => {

  // Ensure path is defined and obtain database reference
  if (config.firestore_path === undefined) {
    throw new Error('Undefined firestore path');
  }
  const docRef = admin.firestore().collection(config.firestore_path).doc(userID);

  // Document creation (if applicable) and optimistic transaction
  let numTries = 0;
  let isSuccessful = false;
  while (numTries < NUM_RETRIES && !isSuccessful) {

    // Wait before retrying if applicable
    await new Promise(resolve => setTimeout(resolve, 1000 * numTries));
    numTries += 1;

    // Try to create the document if one does not exist
    await docRef.get().then(async (doc: DocumentSnapshot): Promise<void> => {
        if (!doc.exists) {
          logs.createDocument(userID, config.firestore_path);
          await docRef.create({
            'sessions': {},
            'last_updated': {},
          }).catch((error) => {
            logs.error(error);
          });
        }
    });

    // Assuming the document exists, try to update it with presence information
    await docRef.get().then(async (doc): Promise<void> => {
      const lastUpdated = doc.updateTime;

      // If the document creation failed, retry
      if (!doc.exists) {
        logs.logRetry(new Error("Document does not exist"));
        return;
      }

      // Ensure the timestamp of operation is more recent
      // Only compare timestamps if the timestamp is undefined and of the correct type
      // Note that if it is not a number, it will assume the session is safe to write over
      const currentData = doc.data();
      if (currentData !== undefined &&
          currentData['last_updated'] !== undefined &&
          currentData['last_updated'][sessionID] !== undefined &&
          typeof currentData['last_updated'][sessionID] === "number") {

        const currentTimestamp = currentData['last_updated'][sessionID];
        logs.logTimestampComparison(currentTimestamp, operationTimestamp, userID, sessionID);

        // Refuse to write the operation if the timestamp is earlier than the latest update
        if ((payload instanceof admin.firestore.FieldValue && currentTimestamp > operationTimestamp) &&
            (currentTimestamp >= operationTimestamp)) {
          throw new Error("Timestamp for operation is outdated, refusing to commit change.");
        }
      }

      // Update the document with presence information and last updated timestamp
      const firestorePayload = {
        [`sessions.${sessionID}`]: payload,
        [`last_updated.${sessionID}`]: operationTimestamp,
      };
      await docRef.update(firestorePayload, {lastUpdateTime: lastUpdated}).then((result) => {
        logs.logFirestoreUpsert(firestorePayload);
        isSuccessful = true;
      }).catch(async (error) => {
        logs.logRetry(error);
      });
    });
  }

  // Log a failure
  if (!isSuccessful) {
    throw new Error(`Failed to commit change after ${numTries}`);
  }
};

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

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import config from './config';
import * as logs from './logs';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

admin.initializeApp();
const TIME_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in MS
enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

logs.init();

/**
 * Handler that listens to the document in RTDB containing user/session
 * information. The function calls the correct handler (upserts/deletes).
 */
export const writeToFirestore =
    functions.handler.database.ref.onWrite(async (change, context) => {
      logs.startPresence();
      try {
        const changeType = getChangeType(change);
        const userInfo = getUserAndSessionID(context.resource.name);
        const operationTimestamp = Date.parse(context.timestamp);
        const payload = validatePayload(change.after.val());

        switch (changeType) {
          case ChangeType.CREATE:
            logs.handleCreate(userInfo['sessionID']);
            await firestoreTransactionWithRetries(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
            break;
          case ChangeType.UPDATE:
            logs.handleUpdate(userInfo['sessionID']);
            await firestoreTransactionWithRetries(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
            break;
          case ChangeType.DELETE:
            logs.handleDelete(userInfo['sessionID']);
            await firestoreTransactionWithRetries(admin.firestore.FieldValue.delete(), operationTimestamp, userInfo['userID'], userInfo['sessionID']);
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
 * Use pessimistic transactions to clean up old tombstones whose timestamp is older
 * than TIME_THRESHOLD and is not currently online.
 *
 * @param userID: reference
 */
export const cleanUpDeadSessions = functions.handler.pubsub.topic.onPublish(async () => {
  logs.startCleanup();

  if (config.firestore_path === undefined) {
    throw new Error('Undefined firestore path. Please re-install and reconfigure the Firestore collection.');
  }
  const docRefArr = await admin.firestore().collection(config.firestore_path).listDocuments();
  const currentTime = (new Date).getTime();

  for (const docRef of docRefArr) {

    // Run pessimistic transaction on each user document to remove tombstones
    logs.currentDocument(docRef.id);
    await admin.firestore().runTransaction(async (transaction): Promise<void> => {
      await transaction.get(docRef).then( async (doc): Promise<void> => {
        const docData = doc.data();

        // Read tombstone data if available
        if (docData !== undefined && docData["last_updated"] instanceof Object) {

          // For each tombstone, determine which are old enough to delete (specified by TIME_THRESHOLD)
          const updateArr: { [s: string]: admin.firestore.FieldValue; } = {};
          for (const sessionID of Object.keys(docData["last_updated"])) {
            if ((docData["sessions"] === undefined || docData["sessions"][sessionID] === undefined) &&
                docData["last_updated"][sessionID] + TIME_THRESHOLD_MS < currentTime) {
              updateArr[`last_updated.${sessionID}`] = admin.firestore.FieldValue.delete();
            }
          }

          // Remove the documents if applicable
          if (Object.keys(updateArr).length > 0) {
            logs.tombstoneRemoval(Object.keys(updateArr));
            await transaction.update(docRef, updateArr);
          }
        }
      });
    }).catch( (error) => {
      logs.error(error);
    });
  }
});

/**
 * validatePayload recursively iterates through the payload to prepare it for
 * Firestore. The main purpose is to convert all arrays to objects and undefined to null.
 *
 * @param payload: any arbitrary object
 */
const validatePayload = (payload: any): any => {
  if (payload === undefined || payload === null) {
    return null;
  } else if (typeof payload === 'object') {
    const validPayload: {[s: string]: object} = {};
    for (const key of Object.keys(payload)) {
      validPayload[key] = validatePayload(payload[key]);
    }
    return validPayload;
  } else {
    return payload;
  }
};

/**
 * Returns the operation performed on the document based on the before/after
 * data snapshot
 *
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
 * Grab the User and Session ID information from the RTDB path. Assumes {RTDB_PATH}/{userID}/sessions/{sessionID} schema
 *
 * @param path of the function trigger
 */
const getUserAndSessionID = (path: string) => {

  const strArr = path.split('/');
  if (strArr.length < 3 && strArr[strArr.length - 2] !== 'sessions') {
    throw new Error(
        `Error trying to get sessionID and userID. Assumes {RTDB_PATH}/{userID}/sessions/{sessionID} structure, got ${path}`);
  }

  // Assume the correct data structure when extracting session/user IDs
  const data = {
    'userID': strArr[strArr.length - 3],
    'sessionID': strArr[strArr.length - 1],
  };
  logs.sessionInfo(data['sessionID'], data['userID']);
  return data;
};

/**
 * Performs an optimistic transaction at the docRef given the operation timestamp is more recent
 * than the most recent operation applied at the destination. This function is exported for the
 * purpose of testing.
 *
 * @param docRef: reference to the firestore document
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
export const firestoreTransaction = async (docRef: admin.firestore.DocumentReference, payload: any, operationTimestamp: number, userID: string, sessionID: string): Promise<void> => {

    // Try to create the document if one does not exist, error here is non-fatal
    await docRef.get().then(async (doc: DocumentSnapshot): Promise<admin.firestore.WriteResult | void> => {
        if (!doc.exists) {
          logs.createDocument(docRef.id, docRef.parent.id);
          return docRef.create({
            'sessions': {},
            'last_updated': {},
          })
        }
    }).catch((error) => {
      logs.nonFatalError(error);
    });

    // Assuming the document exists, try to update it with presence information
  return docRef.get().then(async (doc): Promise<void> => {
      const lastUpdated = doc.updateTime;

      // If the document creation failed, retry
      if (!doc.exists) {
        throw new Error(`Document for ${userID} does not exist!`);
      }

      // Ensure the timestamp of operation is more recent
      // Only compare timestamps if the timestamp is undefined and of the correct type
      // Note that if it is not a number, it will assume the session is safe to write over
      const currentData = doc.data();
      if (currentData !== undefined &&
          currentData['last_updated'] !== undefined &&
          currentData['last_updated'][sessionID] !== undefined) {

        let currentTimestamp = currentData['last_updated'][sessionID];
        if (typeof currentTimestamp === "string") {
          currentTimestamp = parseInt(currentTimestamp);
        }

        // Refuse to write the operation if the timestamp is earlier than the latest update
        if (payload === admin.firestore.FieldValue.delete() && currentTimestamp === operationTimestamp) {
          logs.overwriteOnline(operationTimestamp);
        } else if (currentTimestamp >= operationTimestamp) {
          logs.staleTimestamp(currentTimestamp, operationTimestamp, userID, sessionID);
          return;
        }
      }

      // Update the document with presence information and last updated timestamp
      const firestorePayload = {
        [`sessions.${sessionID}`]: payload,
        [`last_updated.${sessionID}`]: operationTimestamp,
      };
      return docRef.update(firestorePayload, {lastUpdateTime: lastUpdated}).then((result) => {
        logs.successfulFirestoreTransaction();
      })
    });
};

/**
 * firestoreTransactionWithRetries will try until success or function timeout:
 *      1: Document Creation failed and document doesn't exist
 *      2: Document update fails preconditions
 *      3: Document is unable to be read
 *
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransactionWithRetries = async (payload: any, operationTimestamp: number, userID: string, sessionID: string): Promise<void> => {

  // Ensure path is defined and obtain database reference
  if (config.firestore_path === undefined) {
    throw new Error('Undefined firestore path. Please re-install and reconfigure the Firestore collection.');
  }

  // Document creation (if applicable) and optimistic transaction
  // The function retries until it is successful or
  let numTries = 0;
  let isSuccessful = false;
  while (!isSuccessful) {

    // Try the transaction
    await firestoreTransaction(admin.firestore().collection(config.firestore_path).doc(userID), payload, operationTimestamp, userID, sessionID).then(() => {
      isSuccessful = true;
    }).catch(async (error) => {
      // Keep in retrying with linear backoff if there is an error
      numTries += 1;
      const numMilliseconds = 1000 * numTries;
      logs.retry(error, numTries, numMilliseconds);
      await new Promise(resolve => setTimeout(resolve, numMilliseconds));
    });
  }
};


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

import config from './config';

export const error = (err: Error) => {
  console.error('Error executing mod: ', err);
};

export const nonFatalError = (err: Error) => {
  console.error('Non-fatal error encountered (continuing execution): ', err);
};

export const init = () => {
  console.log("Initializing mod with configuration", config);
};

export const startPresence = () => {
  console.log('Started mod execution (presence) with config \n', config);
};

export const startCleanup = () => {
  console.log('Started mod execution (cleanup) with config \n', config);
};

export const handleCreate = (sessionID: string) => {
  console.log(`Detected new connection. Creating new path: ${sessionID}`);
};

export const handleUpdate = (sessionID: string, payload: object) => {
  console.log(`Detected metadata update for session: ${sessionID} with payload: ${JSON.stringify(payload)}`);
};

export const handleDelete = (sessionID: string) => {
  console.log(`Detected disconnect. Removing connection: ${sessionID}`);
};

export const sessionInfo = (sessionID: string, userID: string) => {
  console.log(`Mod executing for user: ${userID}, connection: ${sessionID}`);
};

export const overwriteOnline = (timestamp: number) => {
  console.log(`Received a delete operation with timestamp equivalent to that of the destination. Committing the operation (offline win timestamp ties).`);
};

export const staleTimestamp = (currentTimestamp: number, operationTimestamp: number, userID: string, sessionID: string) => {
  console.log(`Timestamp of current operation is older than timestamp at destination. Refusing to commit change.` +
      `(user: ${userID}, session: ${sessionID} | Destination Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp})`);
};

export const successfulFirestoreTransaction = (payload: object) => {
  console.log(`Firestore document successfully updated with payload: ${JSON.stringify(payload)}`);
};

export const success = () => {
  console.log("User presence extension successfully executed.");
};

export const createDocument = (document: string, collection: string | undefined) => {
  console.log(`Creating document ${document} at Collection ${collection} `);
};

export const retry = (err: Error, numRetries: number, delayMS: number) => {
  console.error(`Error committing changes to Firestore, retrying (Attempt ${numRetries}, Waiting ${delayMS / 1000} seconds).\n Error: `, err);
};

export const tombstoneRemoval = (updateArr: object) => {
  console.log(`Removing the following tombstones: ${JSON.stringify(updateArr)}`);
};

export const currentDocument = (document: string) => {
  console.log(`Reading Document: ${document}`);
};

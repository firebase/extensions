"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.error = (err) => {
    console.error('Error executing mod: ', err);
};
exports.nonFatalError = (err) => {
    console.error('Non-fatal error encountered (continuing execution): ', err);
};
exports.init = () => {
    console.log("Initializing mod with configuration", config_1.default);
};
exports.startPresence = () => {
    console.log('Started mod execution (presence) with config \n', config_1.default);
};
exports.startCleanup = () => {
    console.log('Started mod execution (cleanup) with config \n', config_1.default);
};
exports.handleCreate = (sessionID) => {
    console.log(`Detected new connection. Creating new path: ${sessionID}`);
};
exports.handleUpdate = (sessionID, payload) => {
    console.log(`Detected metadata update for session: ${sessionID} with payload: ${JSON.stringify(payload)}`);
};
exports.handleDelete = (sessionID) => {
    console.log(`Detected disconnect. Removing connection: ${sessionID}`);
};
exports.sessionInfo = (sessionID, userID) => {
    console.log(`Mod executing for user: ${userID}, connection: ${sessionID}`);
};
exports.overwriteOnline = (timestamp) => {
    console.log(`Received a delete operation with timestamp equivalent to that of the destination. Committing the operation (offline win timestamp ties).`);
};
exports.staleTimestamp = (currentTimestamp, operationTimestamp, userID, sessionID) => {
    console.log(`Timestamp of current operation is older than timestamp at destination. Refusing to commit change.` +
        `(user: ${userID}, session: ${sessionID} | Destination Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp})`);
};
exports.successfulFirestoreTransaction = (payload) => {
    console.log(`Firestore document successfully updated with payload: ${JSON.stringify(payload)}`);
};
exports.success = () => {
    console.log("User presence extension successfully executed.");
};
exports.createDocument = (document, collection) => {
    console.log(`Creating document ${document} at Collection ${collection} `);
};
exports.retry = (err, numRetries, delayMS) => {
    console.error(`Error committing changes to Firestore, retrying (Attempt ${numRetries}, Waiting ${delayMS / 1000} seconds).\n Error: `, err);
};
exports.tombstoneRemoval = (updateArr) => {
    console.log(`Removing the following tombstones: ${JSON.stringify(updateArr)}`);
};
exports.currentDocument = (document) => {
    console.log(`Reading Document: ${document}`);
};
//# sourceMappingURL=logs.js.map
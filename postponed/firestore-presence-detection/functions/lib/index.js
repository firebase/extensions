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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const config_1 = require("./config");
const logs = require("./logs");
admin.initializeApp();
const TIME_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (ChangeType = {}));
/**
 * Handler that listens to the document in RTDB containing user/session
 * information. The function calls the correct handler (upserts/deletes).
 *
 * The mod does not handle stale session deletes
 */
exports.writeToFirestore = functions.handler.database.ref.onWrite((change, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const changeType = getChangeType(change);
        const userInfo = getUserAndSessionID(context.resource.name);
        const operationTimestamp = Date.parse(context.timestamp);
        const payload = JSON.parse(JSON.stringify(change.after.val()));
        switch (changeType) {
            case ChangeType.CREATE:
                logs.handleCreate(userInfo['sessionID']);
                yield firestoreTransactionWithRetries(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            case ChangeType.UPDATE:
                logs.handleUpdate(userInfo['sessionID'], payload);
                yield firestoreTransactionWithRetries(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            case ChangeType.DELETE:
                logs.handleDelete(userInfo['sessionID']);
                yield firestoreTransactionWithRetries(admin.firestore.FieldValue.delete(), operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            default:
                logs.error(new Error(`Invalid change type: ${changeType}`));
        }
        logs.success();
    }
    catch (err) {
        logs.error(err);
    }
}));
/**
 * TODO design review
 *
 * Use pessimistic transactions to clean up old tombstones whose timestamp is older
 * than TIME_THRESHOLD and is not currently online.
 *
 * The function is triggered when any message is triggered to the topic.
 *
 * @param userID: reference
 */
exports.cleanUpDeadSessions = functions.handler.pubsub.topic.onPublish(() => __awaiter(this, void 0, void 0, function* () {
    if (config_1.default.firestore_path === undefined) {
        throw new Error('Undefined firestore path');
    }
    const docRefArr = yield admin.firestore().collection(config_1.default.firestore_path).listDocuments();
    const currentTime = (new Date).getTime();
    for (const docRef of docRefArr) {
        // Run pessimistic transaction on each user document to remove tombstones
        logs.currentDocument(docRef.id);
        yield admin.firestore().runTransaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            yield transaction.get(docRef).then((doc) => __awaiter(this, void 0, void 0, function* () {
                const docData = doc.data();
                // Read tombstone data if available
                if (docData !== undefined && docData["last_updated"] instanceof Object) {
                    // For each tombstone, determine which are old enough to delete (specified by TIME_THRESHOLD)
                    const updateArr = {};
                    for (const sessionID of Object.keys(docData["last_updated"])) {
                        if ((docData["sessions"] === undefined || docData["sessions"][sessionID] === undefined) &&
                            docData["last_updated"][sessionID] + TIME_THRESHOLD_MS < currentTime) {
                            updateArr[`last_updated.${sessionID}`] = admin.firestore.FieldValue.delete();
                        }
                    }
                    // Remove the documents if applicable
                    if (Object.keys(updateArr).length > 0) {
                        logs.tombstoneRemoval(Object.keys(updateArr));
                        yield transaction.update(docRef, updateArr);
                    }
                }
            }));
        })).catch((error) => {
            logs.error(error);
        });
        console.log("Done reading document: " + docRef.id);
    }
}));
/**
 * Returns the operation performed on the document based on the before/after
 * data snapshot
 * @param change: the before/after datasnapshot
 */
const getChangeType = (change) => {
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
const getUserAndSessionID = (path) => {
    const strArr = path.split('/');
    if (strArr.length < 3) {
        throw new Error(`Error trying to get sessionID and userID. Assumes {RTDB_PATH}/{userID}/sessions/{sessionID} structure, got ${path}`);
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
 * than the most recent operation applied at the destination.
 *
 * @param docRef: reference to the firestore document
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransaction = (docRef, payload, operationTimestamp, userID, sessionID) => __awaiter(this, void 0, void 0, function* () {
    // Try to create the document if one does not exist, error here is non-fatal
    yield docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
        if (!doc.exists) {
            logs.createDocument(userID, config_1.default.firestore_path);
            return docRef.create({
                'sessions': {},
                'last_updated': {},
            });
        }
    })).catch((error) => {
        logs.nonFatalError(error);
    });
    // Assuming the document exists, try to update it with presence information
    return docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
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
            currentData['last_updated'][sessionID] !== undefined &&
            typeof currentData['last_updated'][sessionID] === "number") {
            const currentTimestamp = currentData['last_updated'][sessionID];
            // Refuse to write the operation if the timestamp is earlier than the latest update
            if ((payload instanceof admin.firestore.FieldValue && currentTimestamp > operationTimestamp) &&
                (currentTimestamp >= operationTimestamp)) {
                logs.staleTimestamp(currentTimestamp, operationTimestamp, userID, sessionID);
                return;
            }
        }
        // Update the document with presence information and last updated timestamp
        const firestorePayload = {
            [`sessions.${sessionID}`]: payload,
            [`last_updated.${sessionID}`]: operationTimestamp,
        };
        return docRef.update(firestorePayload, { lastUpdateTime: lastUpdated }).then((result) => {
            logs.successfulFirestoreTransaction(firestorePayload);
        });
    }));
});
/**
 * The function logic will try until success or function timeout:
 *      1: Document Creation failed and document doesn't exist
 *      2: Document update fails preconditions
 *      3: Document is unable to be read
 *
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransactionWithRetries = (payload, operationTimestamp, userID, sessionID) => __awaiter(this, void 0, void 0, function* () {
    // Ensure path is defined and obtain database reference
    if (config_1.default.firestore_path === undefined) {
        throw new Error('Undefined firestore path');
    }
    // Document creation (if applicable) and optimistic transaction
    // The function retries until it is successful or
    let numTries = 0;
    let isSuccessful = false;
    while (!isSuccessful) {
        // Wait before retrying (linear)
        yield new Promise(resolve => setTimeout(resolve, 1000 * numTries));
        numTries += 1;
        // Try the transaction
        yield firestoreTransaction(admin.firestore().collection(config_1.default.firestore_path).doc(userID), payload, operationTimestamp, userID, sessionID).then(() => {
            isSuccessful = true;
        }).catch((error) => __awaiter(this, void 0, void 0, function* () {
            logs.retry(error);
        }));
    }
});
//# sourceMappingURL=index.js.map
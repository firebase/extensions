"use strict";
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
const NUM_RETRIES = 20; // Should be set such that timeout is not exceeded (for 540s timeout, max retries is approx 30)
// const TIME_THRESHOLD = 7 * 24 * 60 * 60 * 1000;
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
                yield firestoreTransaction(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            case ChangeType.UPDATE:
                logs.handleUpdate(userInfo['sessionID'], payload);
                yield firestoreTransaction(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            case ChangeType.DELETE:
                logs.handleDelete(userInfo['sessionID']);
                yield firestoreTransaction(admin.firestore.FieldValue.delete(), operationTimestamp, userInfo['userID'], userInfo['sessionID']);
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
    logs.getSessionInfo(data['sessionID'], data['userID']);
    return data;
};
/**
 * Performs an optimistic transaction at the docRef given the operation timestamp is more recent
 * than the most recent operation applied at the destination. The function logic will try up to
 * NUM_RETRIES times if the following occur:
 *      1: Document Creation failed and document doesn't exist
 *      2: Document update fails preconditions
 *      3: Document is unable to be read
 *
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransaction = (payload, operationTimestamp, userID, sessionID) => __awaiter(this, void 0, void 0, function* () {
    // Ensure path is defined and obtain database reference
    if (config_1.default.firestore_path === undefined) {
        throw new Error('Undefined firestore path');
    }
    const docRef = admin.firestore().collection(config_1.default.firestore_path).doc(userID);
    // Document creation (if applicable) and optimistic transaction
    let numTries = 0;
    let isSuccessful = false;
    // TODO maybe make this retry until the function timeout instead?
    while (numTries < NUM_RETRIES && !isSuccessful) {
        // Wait before retrying if applicable
        yield new Promise(resolve => setTimeout(resolve, 1000 * numTries));
        numTries += 1;
        // Try to create the document if one does not exist
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
        yield docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
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
                    logs.logStaleTimestamp(currentTimestamp, operationTimestamp, userID, sessionID);
                    isSuccessful = true;
                    return;
                }
            }
            // Update the document with presence information and last updated timestamp
            const firestorePayload = {
                [`sessions.${sessionID}`]: payload,
                [`last_updated.${sessionID}`]: operationTimestamp,
            };
            return docRef.update(firestorePayload, { lastUpdateTime: lastUpdated }).then((result) => {
                logs.logFirestoreUpsert(firestorePayload);
                isSuccessful = true;
            });
        })).catch((error) => __awaiter(this, void 0, void 0, function* () {
            logs.logRetry(error);
        }));
    }
    // Log a failure after attempting to retry
    if (!isSuccessful) {
        throw new Error(`Failed to commit change after ${numTries}`);
    }
});
// /**
//  * TODO probably can use this as a function that needs to be manually triggered
//  * @param collRef
//  */
// const cleanUpDeadSessions = async (collRef: admin.firestore.CollectionReference) => {
//   const docRefArr = await collRef.listDocuments();
//   const currentTime = (new Date).getTime();
//
//   docRefArr.forEach( async (docRef) => {
//
//     // TODO implement a retry for this document
//     await docRef.get().then( async (doc) => {
//       const docData = doc.data();
//       const lastUpdated = doc.updateTime;
//       if (docData !== undefined && docData["last_updated"] !== undefined) {
//
//         // For each tombstone, determine which are old enough to delete (specified by TIME_THRESHOLD)
//         const updateArr: { [s: string]: admin.firestore.FieldValue; } = {};
//         for (const sessionID of docData["last_updated"]) {
//           if ((docData["sessions"] === undefined || docData["sessions"][sessionID] === undefined) &&
//               docData["last_updated"][sessionID] + TIME_THRESHOLD < currentTime) {
//             updateArr[`last_updated.${sessionID}`] = admin.firestore.FieldValue.delete();
//           }
//         }
//
//         // Remove the documents
//         // TODO move out these logs
//         console.log("Removing the following tombstones: " + JSON.stringify(updateArr));
//         docRef.update(updateArr, {lastUpdateTime: lastUpdated});
//       }
//     });
//   });
// };
//# sourceMappingURL=index.js.map
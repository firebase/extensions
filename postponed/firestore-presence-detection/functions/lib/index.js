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
const NUM_RETRIES = 20;
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
        const path = `${config_1.default.firestore_path}/${userInfo['userID']}/sessions/${userInfo['sessionID']}`;
        switch (changeType) {
            case ChangeType.CREATE:
            case ChangeType.UPDATE:
                const payload = JSON.parse(JSON.stringify(change.after.val()));
                logs.handleUpsert(path, payload);
                yield firestoreTransaction(payload, operationTimestamp, userInfo['userID'], userInfo['sessionID']);
                break;
            case ChangeType.DELETE:
                logs.handleDelete(path);
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
    logs.getSessionInfo(path);
    const strArr = path.split('/');
    if (strArr.length < 3) {
        throw new Error('Base path has incorrect number of subdirectories (should not happen).');
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
const firestoreTransaction = (payload, operationTimestamp, userID, sessionID) => __awaiter(this, void 0, void 0, function* () {
    // Ensure path is defined and obtain database reference
    if (config_1.default.firestore_path === undefined) {
        throw new Error('Undefined firestore path');
    }
    const docRef = admin.firestore().collection(config_1.default.firestore_path).doc(userID);
    // Document creation (if applicable) and optimistic transaction
    let numTries = 0;
    let isSuccessful = false;
    while (numTries < NUM_RETRIES && !isSuccessful) {
        // Wait before retrying if applicable
        yield new Promise(resolve => setTimeout(resolve, 1000 * numTries));
        numTries += 1;
        // Try to create the document if one does not exist
        yield docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
            if (!doc.exists) {
                logs.createDocument(userID, config_1.default.firestore_path);
                yield docRef.create({
                    'sessions': {},
                    'last_updated': {},
                }).catch((error) => {
                    logs.error(error);
                });
            }
        }));
        // Assuming the document exists, try to update it with presence information
        yield docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
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
            yield docRef.update(firestorePayload, { lastUpdateTime: lastUpdated }).then((result) => {
                logs.logFirestoreUpsert(firestorePayload);
                isSuccessful = true;
            }).catch((error) => __awaiter(this, void 0, void 0, function* () {
                logs.logRetry(error);
            }));
        }));
    }
    // Log a failure
    if (!isSuccessful) {
        throw new Error(`Failed to commit change after ${numTries}`);
    }
});
//# sourceMappingURL=index.js.map
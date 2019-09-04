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
 * Performs a transaction at the docRef given that the timestamp is greater than the timestamp read at the destination
 * @param operationTimestamp: the timestamp in milliseconds of the function invocation operation
 * @param payload: the payload to write at the destination (this may be a delete operation)
 * @param userID: the userID to update
 * @param sessionID: the sessionID to update
 */
const firestoreTransaction = (payload, operationTimestamp, userID, sessionID) => __awaiter(this, void 0, void 0, function* () {
    // Ensure path is defined and obtain database reference
    if (config_1.default.firestore_path === undefined) {
        throw new Error('Undefined firestore path');
    }
    const docRef = admin.firestore().collection(config_1.default.firestore_path).doc(userID);
    // Create the document if one does not exist
    yield docRef.get().then((doc) => __awaiter(this, void 0, void 0, function* () {
        if (!doc.exists) {
            yield docRef.create({
                'sessions': {},
                'last_updated': {},
            }).catch((error) => {
                // TODO think of best way to use this error
                logs.error(error);
            });
        }
    }));
    // Determine whether or not update the Firestore document
    // TODO handle retries
    yield docRef.get().then((doc) => {
        const lastUpdated = doc.updateTime;
        if (!doc.exists) {
            throw new Error('Document does not exist! Should not happen');
        }
        // Check to see if the timestamp of the session exists
        const data = doc.data();
        // TODO handle if TS is wrong type
        if (data !== undefined && data['last_updated'] !== undefined && data['last_updated'][sessionID] !== undefined) {
            const currentTimestamp = data['last_updated'][sessionID];
            logs.compareTimestamp(userID, sessionID);
            logs.logTimestamp(currentTimestamp, operationTimestamp);
            // Refuse to write the operation if the timestamp is earlier than the latest update
            const errorMessage = `Current timestamp (${currentTimestamp}) is older than or equal to operation (${operationTimestamp}) will not commit operation.`;
            if ((payload instanceof admin.firestore.FieldValue && currentTimestamp > operationTimestamp) &&
                (currentTimestamp >= operationTimestamp)) {
                throw new Error(errorMessage);
            }
        }
        // Update the document with presence information and last updated timestamp
        const firestorePayload = {
            [`sessions.${sessionID}`]: payload,
            [`last_updated.${sessionID}`]: operationTimestamp,
        };
        logs.logFirestoreUpsert(firestorePayload);
        docRef.update(firestorePayload, { lastUpdateTime: lastUpdated });
    });
});
// const firestorePessimisticTransaction = async (payload: any, operationTimestamp: number, userID: string, sessionID: string): Promise<void> => {
//
//   // Ensure path is defined and obtain database reference
//   if (config.firestore_path === undefined) {
//     throw new Error('Undefined firestore path');
//   }
//   const docRef = admin.firestore().collection(config.firestore_path).doc(userID);
//
//   return admin.firestore().runTransaction((transaction: admin.firestore.Transaction): Promise<void> => {
//     return transaction.get(docRef).then((doc: DocumentSnapshot): void => {
//
//       // Check to see if the timestamp of the session exists
//       if (doc.exists) {
//       const data = doc.data();
//       if (data !== undefined && data['last_updated'] !== undefined && data['last_updated'][sessionID] !== undefined) {
//         const currentTimestamp = data['last_updated'][sessionID];
//         logs.compareTimestamp(userID, sessionID);
//         logs.logTimestamp(currentTimestamp, operationTimestamp);
//
//         // Refuse to write the operation if the timestamp is earlier than the latest update
//         const errorMessage = `Current timestamp (${currentTimestamp}) is older than or equal to operation (${operationTimestamp}) will not commit operation.`;
//         if ((payload instanceof admin.firestore.FieldValue && currentTimestamp > operationTimestamp) &&
//             (currentTimestamp >= operationTimestamp)) {
//           throw new Error(errorMessage)
//         }
//        }
//       }
//
//       // Update the document with presence information and last updated timestamp
//       const fieldPath = [new admin.firestore.FieldPath('sessions', sessionID),
//         new admin.firestore.FieldPath('last_updated', sessionID)];
//       const firestorePayload = {
//         sessions: {[sessionID]: payload},
//         'last_updated': {[sessionID]: {'timestamp': operationTimestamp}}
//       };
//       logs.logFirestoreUpsert(firestorePayload);
//       transaction.set(docRef, firestorePayload, {mergeFields: fieldPath});
//     });
//   });
// };
// /**
//  * TODO description, what if the normal entry still exists?
//  * @param userID
//  * @param sessionID
//  */
// const removeFirestoreTombstone = (userID: string, sessionID: string): Promise<admin.firestore.WriteResult> => {
//   if (config.firestore_path === undefined) {
//     throw new Error('Undefined firestore path');
//   }
//
//   // Update the document with presence information and last updated timestamp
//   const fieldPath = [new admin.firestore.FieldPath('last_updated', sessionID)];
//   return admin.firestore().collection(config.firestore_path).doc(userID).set({
//     'last_updated': {[sessionID]: admin.firestore.FieldValue.delete()}
//   }, {mergeFields: fieldPath});
// };
//
// /**
//  * TODO implement the method
//  * @param payload
//  * @param userID
//  */
// const cleanUpStaleSessions = async (payload: any, userID: string): Promise<void> => {
//   const path = `${config.rtdb_path}/${userID}`;
//   const operationTimestamp = getTimestamp(payload.val());
//   // TODO extract this log
//   console.log(`Cleaning up stale sessions at: ${path}`);
//
//   admin.database().ref(path).once('value').then((snapshot: admin.database.DataSnapshot): void | Promise<void> => {
//     if (snapshot.exists()) {
//       const updateArr: { [s: string]: null; } = {};
//       const data = snapshot.val();
//       for (const sessionID of data) {
//
//         // Delete the session document if its timestamp is stale AND offline
//         if (getTimestamp(data[sessionID]) + WEEK_SECONDS < operationTimestamp
//             && data[sessionID]["connection"] === "offline") {
//           updateArr[`${path}/${sessionID}`] = null
//         }
//       }
//       return admin.database().ref(path).update(updateArr)
//     }
//   })
// };
//# sourceMappingURL=index.js.map
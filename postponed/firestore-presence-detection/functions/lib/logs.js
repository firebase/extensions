"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.error = (err) => {
    console.error('Error executing mod: ', err);
};
exports.nonFatalError = (err) => {
    console.error('Non-fatal error encountered (continuing execution): ', err);
};
exports.start = () => {
    console.log('Started mod execution with config \n', config_1.default);
};
exports.handleCreate = (sessionID) => {
    console.log("Detected new connection. Creating new path: " + sessionID);
};
exports.handleUpdate = (sessionID, payload) => {
    console.log("Detected metadata update for session: " + sessionID + " with payload: " + JSON.stringify(payload));
};
exports.handleDelete = (sessionID) => {
    console.log(`Detected disconnect. Removing connection: ${sessionID}`);
};
exports.getSessionInfo = (sessionID, userID) => {
    console.log(`Mod executing for user: ${userID}, connection: ${sessionID}`);
};
exports.logStaleTimestamp = (currentTimestamp, operationTimestamp, userID, sessionID) => {
    console.log(`Timestamp of current operation is older than timestamp at destination. Refusing to commit change.` +
        `(user: ${userID}, session: ${sessionID} | Destination Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp})`);
};
exports.logFirestoreUpsert = (payload) => {
    console.log("Firestore document successfully updated with payload: " + JSON.stringify(payload));
};
exports.success = () => {
    console.log("User presence extension successfully executed.");
};
exports.createDocument = (document, collection) => {
    console.log(`Creating document ${document} at Collection ${collection} `);
};
exports.logRetry = (err) => {
    console.error('Error commiting changes to Firestore, retrying. Error: ', err);
};
//# sourceMappingURL=logs.js.map
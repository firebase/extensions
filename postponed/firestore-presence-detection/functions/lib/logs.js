"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.error = (err) => {
    console.error('Error executing mod: ', err);
};
exports.start = () => {
    console.log('Started mod execution with config \n', config_1.default);
};
exports.handleUpsert = (path, payload) => {
    console.log("Upserting data: " + JSON.stringify(payload) + " at path: " + path);
};
exports.handleDelete = (path) => {
    console.log(`Deleting user connection at: ${path}`);
};
exports.getSessionInfo = (path) => {
    console.log(`Obtaining sessionID and userID from path: ${path}`);
};
exports.logTimestampComparison = (currentTimestamp, operationTimestamp, userID, sessionID) => {
    console.log(`Comparing timestamps of user: ${userID}, session: ${sessionID}. Current Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp}`);
};
exports.logFirestoreUpsert = (payload) => {
    console.log("Updating Firestore document with payload: " + JSON.stringify(payload));
};
exports.success = () => {
    console.log("User presence extension successfully executed.");
};
exports.createDocument = (document, collection) => {
    console.log(`Creating document ${document} at Collection ${collection} `);
};
exports.logRetry = (err) => {
    console.error('Error commiting RTDB changes, retrying. Error: ', err);
};
//# sourceMappingURL=logs.js.map
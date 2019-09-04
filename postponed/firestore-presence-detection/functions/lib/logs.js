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
    console.log("Upserting data: " + payload + " at path: " + path);
};
exports.handleDelete = (path) => {
    console.log(`Deleting user connection at: ${path}`);
};
exports.getSessionInfo = (path) => {
    console.log(`Obtaining sessionID and userID from path: ${path}`);
};
exports.compareTimestamp = (userID, sessionID) => {
    console.log(`Comparing 'last_updated' timestamp of user: ${userID}, session: ${sessionID} with that of current operation.`);
};
exports.logTimestamp = (currentTimestamp, operationTimestamp) => {
    console.log(`Current Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp}`);
};
exports.logFirestoreUpsert = (payload) => {
    console.log("Updating Firestore document with payload: " + payload);
};
exports.success = () => {
    console.log("User presence extension successfully executed.");
};
//# sourceMappingURL=logs.js.map
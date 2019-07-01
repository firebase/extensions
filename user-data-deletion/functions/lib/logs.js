"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.complete = (uid) => {
    console.log(`Successfully removed data for user: ${uid}`);
};
exports.firestoreDeleted = () => {
    console.log("Finished deleting user data from Cloud Firestore");
};
exports.firestoreDeleting = () => {
    console.log("Deleting user data from Cloud Firestore");
};
exports.firestoreNotConfigured = () => {
    console.log("Cloud Firestore paths are not configured, skipping");
};
exports.firestorePathDeleted = (path) => {
    console.log(`Deleted: '${path}' from Cloud Firestore`);
};
exports.firestorePathDeleting = (path) => {
    console.log(`Deleting: '${path}' from Cloud Firestore`);
};
exports.firestorePathError = (path, err) => {
    console.error(`Error deleting: '${path}' from Cloud Firestore`, err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.rtdbDeleted = () => {
    console.log("Finished deleting user data from the Realtime Database");
};
exports.rtdbDeleting = () => {
    console.log("Deleting user data from the Realtime Database");
};
exports.rtdbPathDeleted = (path) => {
    console.log(`Deleted: '${path}' from the Realtime Database`);
};
exports.rtdbNotConfigured = () => {
    console.log("Realtime Database paths are not configured, skipping");
};
exports.rtdbPathDeleting = (path) => {
    console.log(`Deleting: '${path}' from the Realtime Database`);
};
exports.rtdbPathError = (path, err) => {
    console.error(`Error deleting: '${path}' from the Realtime Database`, err);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};
exports.storageDeleted = () => {
    console.log("Finished deleting user data from Cloud Storage");
};
exports.storageDeleting = () => {
    console.log("Deleting user data from Cloud Storage");
};
exports.storageNotConfigured = () => {
    console.log("Cloud Storage paths are not configured, skipping");
};
exports.storagePathDeleted = (path) => {
    console.log(`Deleted: '${path}' from Cloud Storage`);
};
exports.storagePathDeleting = (path) => {
    console.log(`Deleting: '${path}' from Cloud Storage`);
};
exports.storagePathError = (path, err) => {
    console.error(`Error deleting: '${path}' from Cloud Storage`, err);
};

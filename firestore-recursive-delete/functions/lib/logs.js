"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configuration = () => ({
    location: process.env.LOCATION,
});
exports.deletePath = (userId, path) => {
    console.log(`User: ${userId} has requested to delete path: '${path}'`);
};
exports.error = (path, e) => {
    console.error(`Error when trying to delete: '${path}'`, e);
};
exports.init = () => {
    console.log("Initialising mod with configuration", configuration());
};
exports.pathMissing = () => {
    console.warn("Unable to delete, no 'path' is specified");
};
exports.start = () => {
    console.log("Started mod execution with configuration", configuration());
};
exports.success = (path) => {
    console.log(`Path: '${path}' was successfully deleted`);
};
exports.userMissingClaim = () => {
    console.warn("Unable to delete, the user does not have the 'fsdelete' custom claim");
};
exports.userUnauthenticated = () => {
    console.warn("Unable to delete, the user is unauthenticated");
};

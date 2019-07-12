"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.childCount = (path, childCount) => {
    console.log(`Node: '${path}' has: ${childCount} children`);
};
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.error = (err) => {
    console.error("Error whilst truncating the database node", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.pathSkipped = (path) => {
    console.log(`Path: '${path}' does not need to be truncated`);
};
exports.pathTruncated = (path, count) => {
    console.log(`Truncated path: '${path}' to ${count} items`);
};
exports.pathTruncating = (path, count) => {
    console.log(`Truncating path: '${path}' to ${count} items`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};

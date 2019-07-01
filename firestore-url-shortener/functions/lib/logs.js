"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const obfuscatedConfig = Object.assign({}, config_1.default, { bitlyAccessToken: "********" });
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.documentCreatedNoUrl = () => {
    console.log("Document was created without a URL, no processing is required");
};
exports.documentCreatedWithUrl = () => {
    console.log("Document was created with a URL");
};
exports.documentDeleted = () => {
    console.log("Document was deleted, no processing is required");
};
exports.documentUpdatedChangedUrl = () => {
    console.log("Document was updated, URL has changed");
};
exports.documentUpdatedDeletedUrl = () => {
    console.log("Document was updated, URL was deleted");
};
exports.documentUpdatedNoUrl = () => {
    console.log("Document was updated, no URL exists, no processing is required");
};
exports.documentUpdatedUnchangedUrl = () => {
    console.log("Document was updated, URL has not changed, no processing is required");
};
exports.error = (err) => {
    console.error("Error when shortening url", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", obfuscatedConfig);
};
exports.shortenUrl = (url) => {
    console.log(`Shortening url: '${url}'`);
};
exports.shortenUrlComplete = (shortUrl) => {
    console.log(`Finished shortening url to: '${shortUrl}'`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", obfuscatedConfig);
};
exports.updateDocument = (path) => {
    console.log(`Updating Firestore Document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    console.log(`Finished updating Firestore Document: '${path}'`);
};

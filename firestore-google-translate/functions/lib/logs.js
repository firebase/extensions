"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.documentCreatedNoMsg = () => {
    console.log("Document was created without a message, no processing is required");
};
exports.documentCreatedWithMsg = () => {
    console.log("Document was created with a message");
};
exports.documentDeleted = () => {
    console.log("Document was deleted, no processing is required");
};
exports.documentUpdatedChangedMsg = () => {
    console.log("Document was updated, message has changed");
};
exports.documentUpdatedDeletedMsg = () => {
    console.log("Document was updated, message was deleted");
};
exports.documentUpdatedNoMsg = () => {
    console.log("Document was updated, no message exists, no processing is required");
};
exports.documentUpdatedUnchangedMsg = () => {
    console.log("Document was updated, message has not changed, no processing is required");
};
exports.error = (err) => {
    console.log("Failed mod execution", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", config_1.default);
};
exports.start = () => {
    console.log("Started mod execution with configuration", config_1.default);
};
exports.translateMsg = (msg, language) => {
    console.log(`Translating msg: '${msg}' into language: '${language}'`);
};
exports.translateMsgComplete = (msg, language) => {
    console.log(`Finished translating msg: '${msg}' into language: '${language}'`);
};
exports.translateMsgError = (msg, language, err) => {
    console.error(`Error translatting msg: '${msg}' into language: '${language}'`, err);
};
exports.translateMsgAllLanguages = (msg, languages) => {
    console.log(`Translating msg: '${msg}' into languages: '${languages.join(",")}'`);
};
exports.translateMsgAllLanguagesComplete = (msg) => {
    console.log(`Finished translating msg: '${msg}'`);
};
exports.translateMsgAllLanguagesError = (msg, err) => {
    console.error(`Error translating msg: '${msg}'`, err);
};
exports.updateDocument = (path) => {
    console.log(`Updating Firestore Document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    console.log(`Finished updating Firestore Document: '${path}'`);
};

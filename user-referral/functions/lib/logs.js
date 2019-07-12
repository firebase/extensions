"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const obfuscatedConfig = Object.assign({}, config_1.default, { sendgridApiKey: "********" });
exports.complete = () => {
    console.log("Completed mod execution");
};
exports.docPathFieldInvalid = (docPath, field) => {
    console.log(`DocPath: ${docPath} or field: '${field}' are invalid`);
};
exports.docPathFieldsUpdated = () => {
    console.log("Updated docPath fields");
};
exports.docPathFieldsUpdating = () => {
    console.log("Updating docPath fields");
};
exports.docPathFieldUpdating = (docPath, field, userId) => {
    console.log(`Updating docPath: '${docPath}' field: '${field}' for user: ${userId}`);
};
exports.errorAcceptInvitation = (err) => {
    console.error("Error when accepting invitation", err);
};
exports.errorSendInvitation = (err) => {
    console.error("Error when sending invitation", err);
};
exports.init = () => {
    console.log("Initialising mod with configuration", obfuscatedConfig);
};
exports.invitationCreated = (path, id) => {
    console.log(`Created invitation id: '${id}' in collection: '${path}'`);
};
exports.invitationCreating = (path) => {
    console.log(`Creating invitation in collection: '${path}'`);
};
exports.invitationDeleted = (invitationId) => {
    console.log(`Deleted invitation: '${invitationId}'`);
};
exports.invitationDeleting = (invitationId) => {
    console.log(`Deleting invitation: '${invitationId}'`);
};
exports.invitationDoesNotExist = (invitationId) => {
    console.log(`Invitation: '${invitationId}' does not exist`);
};
exports.invitationLoaded = (invitationId) => {
    console.log(`Loaded invitation: '${invitationId}'`);
};
exports.invitationLoading = (invitationId) => {
    console.log(`Loading invitation: '${invitationId}'`);
};
exports.invitationSent = (acceptUrl) => {
    console.log(`Sent invitation with acceptUrl: '${acceptUrl}'`);
};
exports.invitationSending = (acceptUrl) => {
    console.log(`Sending invitation with acceptUrl: '${acceptUrl}'`);
};
exports.start = () => {
    console.log("Started mod execution with configuration", obfuscatedConfig);
};
exports.userUnauthenticated = () => {
    console.warn("Unable to delete, the user is unauthenticated");
};

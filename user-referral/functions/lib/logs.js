"use strict";
/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
    console.log("Initializing mod with configuration", obfuscatedConfig);
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

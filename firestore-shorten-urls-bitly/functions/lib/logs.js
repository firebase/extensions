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
exports.updateDocumentComplete = exports.updateDocument = exports.start = exports.shortenUrlComplete = exports.shortenUrl = exports.init = exports.fieldNamesNotDifferent = exports.error = exports.documentUpdatedUnchangedUrl = exports.documentUpdatedNoUrl = exports.documentUpdatedDeletedUrl = exports.documentUpdatedChangedUrl = exports.documentDeleted = exports.documentCreatedWithUrl = exports.documentCreatedNoUrl = exports.complete = void 0;
const firebase_functions_1 = require("firebase-functions");
const config_1 = require("./config");
const obfuscatedConfig = {
    ...config_1.default,
    bitlyAccessToken: "********",
};
exports.complete = () => {
    firebase_functions_1.logger.log("Completed execution of extension");
};
exports.documentCreatedNoUrl = () => {
    firebase_functions_1.logger.log("Document was created without a URL, no processing is required");
};
exports.documentCreatedWithUrl = () => {
    firebase_functions_1.logger.log("Document was created with a URL");
};
exports.documentDeleted = () => {
    firebase_functions_1.logger.log("Document was deleted, no processing is required");
};
exports.documentUpdatedChangedUrl = () => {
    firebase_functions_1.logger.log("Document was updated, URL has changed");
};
exports.documentUpdatedDeletedUrl = () => {
    firebase_functions_1.logger.log("Document was updated, URL was deleted");
};
exports.documentUpdatedNoUrl = () => {
    firebase_functions_1.logger.log("Document was updated, no URL exists, no processing is required");
};
exports.documentUpdatedUnchangedUrl = () => {
    firebase_functions_1.logger.log("Document was updated, URL has not changed, no processing is required");
};
exports.error = (err) => {
    firebase_functions_1.logger.error("Error when shortening URL", err);
};
exports.fieldNamesNotDifferent = () => {
    firebase_functions_1.logger.error("The `URL` and `Short URL` field names must be different for this extension to function correctly");
};
exports.init = () => {
    firebase_functions_1.logger.log("Initializing extension with configuration", obfuscatedConfig);
};
exports.shortenUrl = (url) => {
    firebase_functions_1.logger.log(`Shortening URL: '${url}'`);
};
exports.shortenUrlComplete = (shortUrl) => {
    firebase_functions_1.logger.log(`Finished shortening URL to: '${shortUrl}'`);
};
exports.start = () => {
    firebase_functions_1.logger.log("Started execution of extension with configuration", obfuscatedConfig);
};
exports.updateDocument = (path) => {
    firebase_functions_1.logger.log(`Updating Cloud Firestore document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    firebase_functions_1.logger.log(`Finished updating Cloud Firestore document: '${path}'`);
};

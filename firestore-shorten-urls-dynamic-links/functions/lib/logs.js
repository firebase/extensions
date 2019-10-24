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
exports.complete = () => {
    console.log("Completed execution of extension");
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
    console.error("Error when shortening URL", err);
};
exports.fieldNamesNotDifferent = () => {
    console.error("The `URL` and `Short URL` field names must be different for this extension to function correctly");
};
exports.init = () => {
    console.log("Initializing extension with configuration", config_1.default);
};
exports.shortenUrl = (url) => {
    console.log(`Shortening URL: '${url}'`);
};
exports.shortenUrlComplete = (shortUrl) => {
    console.log(`Finished shortening URL to: '${shortUrl}'`);
};
exports.start = () => {
    console.log("Started execution of extension with configuration", config_1.default);
};
exports.updateDocument = (path) => {
    console.log(`Updating Cloud Firestore document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    console.log(`Finished updating Cloud Firestore document: '${path}'`);
};

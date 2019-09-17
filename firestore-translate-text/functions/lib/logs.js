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
exports.documentCreatedNoInput = () => {
    console.log("Document was created without an input string, no processing is required");
};
exports.documentCreatedWithInput = () => {
    console.log("Document was created with an input string");
};
exports.documentDeleted = () => {
    console.log("Document was deleted, no processing is required");
};
exports.documentUpdatedChangedInput = () => {
    console.log("Document was updated, input string has changed");
};
exports.documentUpdatedDeletedInput = () => {
    console.log("Document was updated, input string was deleted");
};
exports.documentUpdatedNoInput = () => {
    console.log("Document was updated, no input string exists, no processing is required");
};
exports.documentUpdatedUnchangedInput = () => {
    console.log("Document was updated, input string has not changed, no processing is required");
};
exports.error = (err) => {
    console.error("Failed execution of extension", err);
};
exports.fieldNamesNotDifferent = () => {
    console.error("The `Input` and `Output` field names must be different for this extension to function correctly");
};
exports.init = () => {
    console.log("Initializing extension with configuration", config_1.default);
};
exports.inputFieldNameIsOutputPath = () => {
    console.error("The `Input` field name must not be the same as an `Output` path for this extension to function correctly");
};
exports.start = () => {
    console.log("Started execution of extension with configuration", config_1.default);
};
exports.translateInputString = (string, language) => {
    console.log(`Translating string: '${string}' into language(s): '${language}'`);
};
exports.translateStringComplete = (string, language) => {
    console.log(`Finished translating string: '${string}' into language(s): '${language}'`);
};
exports.translateStringError = (string, language, err) => {
    console.error(`Error when translating string: '${string}' into language(s): '${language}'`, err);
};
exports.translateInputStringToAllLanguages = (string, languages) => {
    console.log(`Translating string: '${string}' into language(s): '${languages.join(",")}'`);
};
exports.translateInputToAllLanguagesComplete = (string) => {
    console.log(`Finished translating string: '${string}'`);
};
exports.translateInputToAllLanguagesError = (string, err) => {
    console.error(`Error when translating string: '${string}'`, err);
};
exports.updateDocument = (path) => {
    console.log(`Updating Cloud Firestore document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    console.log(`Finished updating Cloud Firestore document: '${path}'`);
};

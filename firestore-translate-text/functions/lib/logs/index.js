"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDocumentComplete = exports.updateDocument = exports.translateInputToAllLanguagesError = exports.translateInputToAllLanguagesComplete = exports.translateInputStringToAllLanguages = exports.translateStringError = exports.translateStringComplete = exports.translateInputString = exports.start = exports.inputFieldNameIsOutputPath = exports.init = exports.fieldNamesNotDifferent = exports.error = exports.documentUpdatedUnchangedInput = exports.documentUpdatedNoInput = exports.documentUpdatedDeletedInput = exports.documentUpdatedChangedInput = exports.documentDeleted = exports.documentCreatedWithInput = exports.documentCreatedNoInput = exports.complete = void 0;
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
const functions = require("firebase-functions");
const logger = functions.logger;
exports.complete = () => {
    logger.log("Completed execution of extension");
};
exports.documentCreatedNoInput = () => {
    logger.log("Document was created without an input string, no processing is required");
};
exports.documentCreatedWithInput = () => {
    logger.log("Document was created with an input string");
};
exports.documentDeleted = () => {
    logger.log("Document was deleted, no processing is required");
};
exports.documentUpdatedChangedInput = () => {
    logger.log("Document was updated, input string has changed");
};
exports.documentUpdatedDeletedInput = () => {
    logger.log("Document was updated, input string was deleted");
};
exports.documentUpdatedNoInput = () => {
    logger.log("Document was updated, no input string exists, no processing is required");
};
exports.documentUpdatedUnchangedInput = () => {
    logger.log("Document was updated, input string has not changed, no processing is required");
};
exports.error = (err) => {
    logger.error("Failed execution of extension", err);
};
exports.fieldNamesNotDifferent = () => {
    logger.error("The `Input` and `Output` field names must be different for this extension to function correctly");
};
exports.init = (config = {}) => {
    logger.log("Initializing extension with the parameter values", config);
};
exports.inputFieldNameIsOutputPath = () => {
    logger.error("The `Input` field name must not be the same as an `Output` path for this extension to function correctly");
};
exports.start = () => {
    logger.log("Started execution of extension with configuration");
};
exports.translateInputString = (string, language) => {
    logger.log(`Translating string: '${string}' into language(s): '${language}'`);
};
exports.translateStringComplete = (string, language) => {
    logger.log(`Finished translating string: '${string}' into language(s): '${language}'`);
};
exports.translateStringError = (string, language, err) => {
    logger.error(`Error when translating string: '${string}' into language(s): '${language}'`, err);
};
exports.translateInputStringToAllLanguages = (string, languages) => {
    logger.log(`Translating string: '${string}' into language(s): '${languages.join(",")}'`);
};
exports.translateInputToAllLanguagesComplete = (string) => {
    logger.log(`Finished translating string: '${string}'`);
};
exports.translateInputToAllLanguagesError = (string, err) => {
    logger.error(`Error when translating string: '${string}'`, err);
};
exports.updateDocument = (path) => {
    logger.log(`Updating Cloud Firestore document: '${path}'`);
};
exports.updateDocumentComplete = (path) => {
    logger.log(`Finished updating Cloud Firestore document: '${path}'`);
};

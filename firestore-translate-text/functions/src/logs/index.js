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
exports.backfillComplete = exports.updateDocumentComplete = exports.updateDocument = exports.translateInputToAllLanguagesError = exports.translateInputToAllLanguagesComplete = exports.translateInputStringToAllLanguages = exports.translateStringError = exports.translateStringComplete = exports.translateInputString = exports.start = exports.inputFieldNameIsOutputPath = exports.init = exports.fieldNamesNotDifferent = exports.error = exports.documentUpdatedUnchangedInput = exports.documentUpdatedNoInput = exports.documentUpdatedDeletedInput = exports.documentUpdatedChangedInput = exports.documentDeleted = exports.documentFoundNoInput = exports.documentFoundWithInput = exports.documentCreatedWithInput = exports.documentCreatedNoInput = exports.complete = void 0;
const firebase_functions_1 = require("firebase-functions");
const messages_1 = require("./messages");
const complete = () => {
    firebase_functions_1.logger.log(messages_1.messages.complete());
};
exports.complete = complete;
const documentCreatedNoInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentCreatedNoInput());
};
exports.documentCreatedNoInput = documentCreatedNoInput;
const documentCreatedWithInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentCreatedWithInput());
};
exports.documentCreatedWithInput = documentCreatedWithInput;
const documentFoundWithInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentFoundWithInput());
};
exports.documentFoundWithInput = documentFoundWithInput;
const documentFoundNoInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentFoundNoInput());
};
exports.documentFoundNoInput = documentFoundNoInput;
const documentDeleted = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentDeleted());
};
exports.documentDeleted = documentDeleted;
const documentUpdatedChangedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedChangedInput());
};
exports.documentUpdatedChangedInput = documentUpdatedChangedInput;
const documentUpdatedDeletedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedDeletedInput());
};
exports.documentUpdatedDeletedInput = documentUpdatedDeletedInput;
const documentUpdatedNoInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedNoInput());
};
exports.documentUpdatedNoInput = documentUpdatedNoInput;
const documentUpdatedUnchangedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedUnchangedInput());
};
exports.documentUpdatedUnchangedInput = documentUpdatedUnchangedInput;
const error = (err) => {
    firebase_functions_1.logger.error(...messages_1.messages.error(err));
};
exports.error = error;
const fieldNamesNotDifferent = () => {
    firebase_functions_1.logger.error(messages_1.messages.fieldNamesNotDifferent());
};
exports.fieldNamesNotDifferent = fieldNamesNotDifferent;
const init = (config) => {
    firebase_functions_1.logger.log(...messages_1.messages.init(config));
};
exports.init = init;
const inputFieldNameIsOutputPath = () => {
    firebase_functions_1.logger.error(messages_1.messages.inputFieldNameIsOutputPath());
};
exports.inputFieldNameIsOutputPath = inputFieldNameIsOutputPath;
const start = (config) => {
    firebase_functions_1.logger.log(...messages_1.messages.start(config));
};
exports.start = start;
const translateInputString = (string, language) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputString(string, language));
};
exports.translateInputString = translateInputString;
const translateStringComplete = (string, language) => {
    firebase_functions_1.logger.log(messages_1.messages.translateStringComplete(string, language));
};
exports.translateStringComplete = translateStringComplete;
const translateStringError = (string, language, err) => {
    firebase_functions_1.logger.error(...messages_1.messages.translateStringError(string, language, err));
};
exports.translateStringError = translateStringError;
const translateInputStringToAllLanguages = (string, languages) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputStringToAllLanguages(string, languages));
};
exports.translateInputStringToAllLanguages = translateInputStringToAllLanguages;
const translateInputToAllLanguagesComplete = (string) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputToAllLanguagesComplete(string));
};
exports.translateInputToAllLanguagesComplete = translateInputToAllLanguagesComplete;
const translateInputToAllLanguagesError = (string, err) => {
    firebase_functions_1.logger.error(...messages_1.messages.translateInputToAllLanguagesError(string, err));
};
exports.translateInputToAllLanguagesError = translateInputToAllLanguagesError;
const updateDocument = (path) => {
    firebase_functions_1.logger.log(messages_1.messages.updateDocument(path));
};
exports.updateDocument = updateDocument;
const updateDocumentComplete = (path) => {
    firebase_functions_1.logger.log(messages_1.messages.updateDocumentComplete(path));
};
exports.updateDocumentComplete = updateDocumentComplete;
const backfillComplete = (successCount, errorCount) => {
    firebase_functions_1.logger.log(messages_1.messages.backfillComplete(successCount, errorCount));
};
exports.backfillComplete = backfillComplete;

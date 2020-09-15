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
exports.updateDocumentComplete = exports.updateDocument = exports.translateInputToAllLanguagesError = exports.translateInputToAllLanguagesComplete = exports.translateInputStringToAllLanguages = exports.translateStringError = exports.translateStringComplete = exports.translateInputString = exports.start = exports.inputFieldNameIsOutputPath = exports.init = exports.fieldNamesNotDifferent = exports.error = exports.documentUpdatedUnchangedInput = exports.documentUpdatedNoInput = exports.documentUpdatedDeletedInput = exports.documentUpdatedChangedInput = exports.documentDeleted = exports.documentCreatedWithInput = exports.documentCreatedNoInput = exports.complete = void 0;
const firebase_functions_1 = require("firebase-functions");
const messages_1 = require("./messages");
exports.complete = () => {
    firebase_functions_1.logger.log(messages_1.messages.complete());
};
exports.documentCreatedNoInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentCreatedNoInput());
};
exports.documentCreatedWithInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentCreatedWithInput());
};
exports.documentDeleted = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentDeleted());
};
exports.documentUpdatedChangedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedChangedInput());
};
exports.documentUpdatedDeletedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedDeletedInput());
};
exports.documentUpdatedNoInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedNoInput());
};
exports.documentUpdatedUnchangedInput = () => {
    firebase_functions_1.logger.log(messages_1.messages.documentUpdatedUnchangedInput());
};
exports.error = (err) => {
    firebase_functions_1.logger.error(...messages_1.messages.error(err));
};
exports.fieldNamesNotDifferent = () => {
    firebase_functions_1.logger.error(messages_1.messages.fieldNamesNotDifferent());
};
exports.init = (config) => {
    firebase_functions_1.logger.log(...messages_1.messages.init(config));
};
exports.inputFieldNameIsOutputPath = () => {
    firebase_functions_1.logger.error(messages_1.messages.inputFieldNameIsOutputPath());
};
exports.start = (config) => {
    firebase_functions_1.logger.log(...messages_1.messages.start(config));
};
exports.translateInputString = (string, language) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputString(string, language));
};
exports.translateStringComplete = (string, language) => {
    firebase_functions_1.logger.log(messages_1.messages.translateStringComplete(string, language));
};
exports.translateStringError = (string, language, err) => {
    firebase_functions_1.logger.error(...messages_1.messages.translateStringError(string, language, err));
};
exports.translateInputStringToAllLanguages = (string, languages) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputStringToAllLanguages(string, languages));
};
exports.translateInputToAllLanguagesComplete = (string) => {
    firebase_functions_1.logger.log(messages_1.messages.translateInputToAllLanguagesComplete(string));
};
exports.translateInputToAllLanguagesError = (string, err) => {
    firebase_functions_1.logger.error(...messages_1.messages.translateInputToAllLanguagesError(string, err));
};
exports.updateDocument = (path) => {
    firebase_functions_1.logger.log(messages_1.messages.updateDocument(path));
};
exports.updateDocumentComplete = (path) => {
    firebase_functions_1.logger.log(messages_1.messages.updateDocumentComplete(path));
};

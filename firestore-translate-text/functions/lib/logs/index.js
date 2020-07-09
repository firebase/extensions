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
const config_1 = require("../config");
const messages_1 = require("./messages");
exports.complete = () => {
    console.log(messages_1.messages.complete());
};
exports.documentCreatedNoInput = () => {
    console.log(messages_1.messages.documentCreatedNoInput());
};
exports.documentCreatedWithInput = () => {
    console.log(messages_1.messages.documentCreatedWithInput());
};
exports.documentDeleted = () => {
    console.log(messages_1.messages.documentDeleted());
};
exports.documentUpdatedChangedInput = () => {
    console.log(messages_1.messages.documentUpdatedChangedInput());
};
exports.documentUpdatedDeletedInput = () => {
    console.log(messages_1.messages.documentUpdatedDeletedInput());
};
exports.documentUpdatedNoInput = () => {
    console.log(messages_1.messages.documentUpdatedNoInput());
};
exports.documentUpdatedUnchangedInput = () => {
    console.log(messages_1.messages.documentUpdatedUnchangedInput());
};
exports.error = (err) => {
    console.error(...messages_1.messages.error(err));
};
exports.fieldNamesNotDifferent = () => {
    console.error(messages_1.messages.fieldNamesNotDifferent());
};
exports.init = () => {
    console.log(...messages_1.messages.init(config_1.default));
};
exports.inputFieldNameIsOutputPath = () => {
    console.error(messages_1.messages.inputFieldNameIsOutputPath());
};
exports.start = () => {
    console.log(...messages_1.messages.start(config_1.default));
};
exports.translateInputString = (string, language) => {
    console.log(messages_1.messages.translateInputString(string, language));
};
exports.translateStringComplete = (string, language) => {
    console.log(messages_1.messages.translateStringComplete(string, language));
};
exports.translateStringError = (string, language, err) => {
    console.error(...messages_1.messages.translateStringError(string, language, err));
};
exports.translateInputStringToAllLanguages = (string, languages) => {
    console.log(messages_1.messages.translateInputStringToAllLanguages(string, languages));
};
exports.translateInputToAllLanguagesComplete = (string) => {
    console.log(messages_1.messages.translateInputToAllLanguagesComplete(string));
};
exports.translateInputToAllLanguagesError = (string, err) => {
    console.error(...messages_1.messages.translateInputToAllLanguagesError(string, err));
};
exports.updateDocument = (path) => {
    console.log(...messages_1.messages.updateDocument(path));
};
exports.updateDocumentComplete = (path) => {
    console.log(...messages_1.messages.updateDocumentComplete(path));
};

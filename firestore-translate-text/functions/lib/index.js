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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const translate_1 = require("@google-cloud/translate");
const config_1 = require("./config");
const logs = require("./logs");
const validators = require("./validators");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (ChangeType = {}));
const translate = new translate_1.Translate({ projectId: process.env.PROJECT_ID });
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
exports.fstranslate = functions.handler.firestore.document.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { languages, inputFieldName, outputFieldName } = config_1.default;
    if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
        logs.fieldNamesNotDifferent();
        return;
    }
    if (validators.fieldNameIsTranslationPath(inputFieldName, outputFieldName, languages)) {
        logs.inputFieldNameIsOutputPath();
        return;
    }
    const changeType = getChangeType(change);
    try {
        switch (changeType) {
            case ChangeType.CREATE:
                yield handleCreateDocument(change.after);
                break;
            case ChangeType.DELETE:
                handleDeleteDocument();
                break;
            case ChangeType.UPDATE:
                yield handleUpdateDocument(change.before, change.after);
                break;
        }
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
const extractInput = (snapshot) => {
    return snapshot.get(config_1.default.inputFieldName);
};
const getChangeType = (change) => {
    if (!change.after.exists) {
        return ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
};
const handleCreateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const input = extractInput(snapshot);
    if (input) {
        logs.documentCreatedWithInput();
        yield translateDocument(snapshot);
    }
    else {
        logs.documentCreatedNoInput();
    }
});
const handleDeleteDocument = () => {
    logs.documentDeleted();
};
const handleUpdateDocument = (before, after) => __awaiter(this, void 0, void 0, function* () {
    const inputAfter = extractInput(after);
    const inputBefore = extractInput(before);
    const inputHasChanged = inputAfter !== inputBefore;
    if (!inputHasChanged &&
        inputAfter !== undefined &&
        inputBefore !== undefined) {
        logs.documentUpdatedUnchangedInput();
        return;
    }
    if (inputAfter) {
        logs.documentUpdatedChangedInput();
        yield translateDocument(after);
    }
    else if (inputBefore) {
        logs.documentUpdatedDeletedInput();
        yield updateTranslations(after, admin.firestore.FieldValue.delete());
    }
    else {
        logs.documentUpdatedNoInput();
    }
});
const translateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const input = extractInput(snapshot);
    logs.translateInputStringToAllLanguages(input, config_1.default.languages);
    const tasks = config_1.default.languages.map((targetLanguage) => __awaiter(this, void 0, void 0, function* () {
        return {
            language: targetLanguage,
            output: yield translateString(input, targetLanguage),
        };
    }));
    try {
        const translations = yield Promise.all(tasks);
        logs.translateInputToAllLanguagesComplete(input);
        const translationsMap = translations.reduce((output, translation) => {
            output[translation.language] = translation.output;
            return output;
        }, {});
        yield updateTranslations(snapshot, translationsMap);
    }
    catch (err) {
        logs.translateInputToAllLanguagesError(input, err);
        throw err;
    }
});
const translateString = (string, targetLanguage) => __awaiter(this, void 0, void 0, function* () {
    try {
        logs.translateInputString(string, targetLanguage);
        const [translatedString] = yield translate.translate(string, targetLanguage);
        logs.translateStringComplete(string, targetLanguage);
        return translatedString;
    }
    catch (err) {
        logs.translateStringError(string, targetLanguage, err);
        throw err;
    }
});
const updateTranslations = (snapshot, translations) => __awaiter(this, void 0, void 0, function* () {
    logs.updateDocument(snapshot.ref.path);
    yield snapshot.ref.update(config_1.default.outputFieldName, translations);
    logs.updateDocumentComplete(snapshot.ref.path);
});

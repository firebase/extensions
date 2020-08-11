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
exports.fstranslate = void 0;
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
logs.init(config_1.default);
exports.fstranslate = functions.handler.firestore.document.onWrite(async (change) => {
    logs.start(config_1.default);
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
                await handleCreateDocument(change.after);
                break;
            case ChangeType.DELETE:
                handleDeleteDocument();
                break;
            case ChangeType.UPDATE:
                await handleUpdateDocument(change.before, change.after);
                break;
        }
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
});
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
const handleCreateDocument = async (snapshot) => {
    const input = extractInput(snapshot);
    if (input) {
        logs.documentCreatedWithInput();
        await translateDocument(snapshot);
    }
    else {
        logs.documentCreatedNoInput();
    }
};
const handleDeleteDocument = () => {
    logs.documentDeleted();
};
const handleUpdateDocument = async (before, after) => {
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
        await translateDocument(after);
    }
    else if (inputBefore) {
        logs.documentUpdatedDeletedInput();
        await updateTranslations(after, admin.firestore.FieldValue.delete());
    }
    else {
        logs.documentUpdatedNoInput();
    }
};
const translateDocument = async (snapshot) => {
    const input = extractInput(snapshot);
    logs.translateInputStringToAllLanguages(input, config_1.default.languages);
    const tasks = config_1.default.languages.map(async (targetLanguage) => {
        return {
            language: targetLanguage,
            output: await translateString(input, targetLanguage),
        };
    });
    try {
        const translations = await Promise.all(tasks);
        logs.translateInputToAllLanguagesComplete(input);
        const translationsMap = translations.reduce((output, translation) => {
            output[translation.language] = translation.output;
            return output;
        }, {});
        await updateTranslations(snapshot, translationsMap);
    }
    catch (err) {
        logs.translateInputToAllLanguagesError(input, err);
        throw err;
    }
};
const translateString = async (string, targetLanguage) => {
    try {
        logs.translateInputString(string, targetLanguage);
        const [translatedString] = await translate.translate(string, targetLanguage);
        logs.translateStringComplete(string, targetLanguage);
        return translatedString;
    }
    catch (err) {
        logs.translateStringError(string, targetLanguage, err);
        throw err;
    }
};
const updateTranslations = async (snapshot, translations) => {
    logs.updateDocument(snapshot.ref.path);
    // Wrapping in transaction to allow for automatic retries (#48)
    await admin.firestore().runTransaction((transaction) => {
        transaction.update(snapshot.ref, config_1.default.outputFieldName, translations);
        return Promise.resolve();
    });
    logs.updateDocumentComplete(snapshot.ref.path);
};

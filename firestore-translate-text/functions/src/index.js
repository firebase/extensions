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
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fstranslatebackfill = exports.fstranslate = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const extensions_1 = require("firebase-admin/extensions");
const functions_1 = require("firebase-admin/functions");
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
const DOCS_PER_BACKFILL = 200;
const translate = new translate_1.Translate({ projectId: process.env.PROJECT_ID });
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init(config_1.default);
exports.fstranslate = functions.firestore.document(process.env.COLLECTION_PATH).onWrite((change) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.fstranslatebackfill = functions.tasks.taskQueue().onDispatch((data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const offset = (_a = data["offset"]) !== null && _a !== void 0 ? _a : 0;
    const pastSuccessCount = (_b = data["successCount"]) !== null && _b !== void 0 ? _b : 0;
    const pastErrorCount = (_c = data["errorCount"]) !== null && _c !== void 0 ? _c : 0;
    const snapshot = yield admin.firestore().collection(process.env.COLLECTION_PATH).offset(offset).get();
    const translations = yield Promise.allSettled(snapshot.docs.map(handleExistingDocument));
    const newSucessCount = pastSuccessCount + translations.filter(p => p.status === "fulfilled").length;
    const newErrorCount = pastErrorCount + translations.filter(p => p.status === "rejected").length;
    if (snapshot.size == DOCS_PER_BACKFILL) {
        const queue = (0, functions_1.getFunctions)().taskQueue("fstranslatebackfill", process.env.EXT_INSTANCE_ID);
        yield queue.enqueue({
            offset: offset + DOCS_PER_BACKFILL,
            successCount: newSucessCount,
            errorCount: newErrorCount,
        });
    }
    else {
        logs.backfillComplete(newSucessCount, newErrorCount);
        const runtime = (0, extensions_1.getExtensions)().runtime();
        if (newErrorCount == 0) {
            runtime.setProcessingState("PROCESSING_COMPLETE", `Successfully backfilled ${newSucessCount} documents.`);
        }
        else if (newErrorCount > 0 && newSucessCount > 0) {
            runtime.setProcessingState("PROCESSING_WARNING", `Successfully backfilled ${newSucessCount} documents, failed to translate ${newErrorCount} documents.`);
        }
        if (newErrorCount > 0 && newSucessCount == 0) {
            runtime.setProcessingState("PROCESSING_FAILED", `Successfully backfilled ${newSucessCount} documents, failed to translate ${newErrorCount} documents.`);
        }
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
const handleExistingDocument = (snapshot) => __awaiter(void 0, void 0, void 0, function* () {
    const input = extractInput(snapshot);
    if (input) {
        logs.documentFoundWithInput();
        yield translateDocument(snapshot);
    }
    else {
        logs.documentFoundNoInput();
    }
});
const handleCreateDocument = (snapshot) => __awaiter(void 0, void 0, void 0, function* () {
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
const handleUpdateDocument = (before, after) => __awaiter(void 0, void 0, void 0, function* () {
    const inputBefore = extractInput(before);
    const inputAfter = extractInput(after);
    // If previous and updated documents have no input, skip.
    if (inputBefore === undefined && inputAfter === undefined) {
        logs.documentUpdatedNoInput();
        return;
    }
    // If updated document has no string or object input, delete any existing translations.
    if (typeof inputAfter !== "string" && typeof inputAfter !== "object") {
        yield updateTranslations(after, admin.firestore.FieldValue.delete());
        logs.documentUpdatedDeletedInput();
        return;
    }
    if (JSON.stringify(inputBefore) === JSON.stringify(inputAfter)) {
        logs.documentUpdatedUnchangedInput();
    }
    else {
        logs.documentUpdatedChangedInput();
        yield translateDocument(after);
    }
});
const translateSingle = (input, snapshot) => __awaiter(void 0, void 0, void 0, function* () {
    logs.translateInputStringToAllLanguages(input, config_1.default.languages);
    const tasks = config_1.default.languages.map((targetLanguage) => __awaiter(void 0, void 0, void 0, function* () {
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
        return updateTranslations(snapshot, translationsMap);
    }
    catch (err) {
        logs.translateInputToAllLanguagesError(input, err);
        throw err;
    }
});
const translateMultiple = (input, snapshot) => __awaiter(void 0, void 0, void 0, function* () {
    let translations = {};
    let promises = [];
    Object.entries(input).forEach(([input, value]) => {
        config_1.default.languages.forEach((language) => {
            promises.push(() => new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
                logs.translateInputStringToAllLanguages(value, config_1.default.languages);
                const output = typeof value === "string"
                    ? yield translateString(value, language)
                    : null;
                if (!translations[input])
                    translations[input] = {};
                translations[input][language] = output;
                return resolve();
            })));
        });
    });
    for (const fn of promises) {
        if (fn)
            yield fn();
    }
    return updateTranslations(snapshot, translations);
});
const translateDocument = (snapshot) => __awaiter(void 0, void 0, void 0, function* () {
    const input = extractInput(snapshot);
    if (typeof input === "object") {
        return translateMultiple(input, snapshot);
    }
    yield translateSingle(input, snapshot);
});
const translateString = (string, targetLanguage) => __awaiter(void 0, void 0, void 0, function* () {
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
const updateTranslations = (snapshot, translations) => __awaiter(void 0, void 0, void 0, function* () {
    logs.updateDocument(snapshot.ref.path);
    // Wrapping in transaction to allow for automatic retries (#48)
    yield admin.firestore().runTransaction((transaction) => {
        transaction.update(snapshot.ref, config_1.default.outputFieldName, translations);
        return Promise.resolve();
    });
    logs.updateDocumentComplete(snapshot.ref.path);
});

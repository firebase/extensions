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
    if (config_1.default.messageFieldName === config_1.default.translationsFieldName) {
        logs.fieldNamesNotDifferent();
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
            default:
                throw new Error(`Invalid change type: ${changeType}`);
        }
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
const extractMsg = (snapshot) => {
    return snapshot.get(config_1.default.messageFieldName);
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
    const msg = extractMsg(snapshot);
    if (msg) {
        logs.documentCreatedWithMsg();
        yield translateDocument(snapshot);
    }
    else {
        logs.documentCreatedNoMsg();
    }
});
const handleDeleteDocument = () => {
    logs.documentDeleted();
};
const handleUpdateDocument = (before, after) => __awaiter(this, void 0, void 0, function* () {
    const msgAfter = extractMsg(after);
    const msgBefore = extractMsg(before);
    const msgHasChanged = msgAfter !== msgBefore;
    if (!msgHasChanged) {
        logs.documentUpdatedUnchangedMsg();
        return;
    }
    if (msgAfter) {
        logs.documentUpdatedChangedMsg();
        yield translateDocument(after);
    }
    else if (msgBefore) {
        logs.documentUpdatedDeletedMsg();
        yield updateTranslations(after, admin.firestore.FieldValue.delete());
    }
    else {
        logs.documentUpdatedNoMsg();
    }
});
const translateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const message = extractMsg(snapshot);
    logs.translateMsgAllLanguages(message, config_1.default.languages);
    const tasks = config_1.default.languages.map((targetLanguage) => __awaiter(this, void 0, void 0, function* () {
        const translatedMsg = yield translateMessage(message, targetLanguage);
        return {
            language: targetLanguage,
            message: translatedMsg,
        };
    }));
    try {
        const translations = yield Promise.all(tasks);
        logs.translateMsgAllLanguagesComplete(message);
        const translationsMap = translations.reduce((output, translation) => {
            output[translation.language] = translation.message;
            return output;
        }, {});
        yield updateTranslations(snapshot, translationsMap);
    }
    catch (err) {
        logs.translateMsgAllLanguagesError(message, err);
        throw err;
    }
});
const translateMessage = (msg, targetLanguage) => __awaiter(this, void 0, void 0, function* () {
    try {
        logs.translateMsg(msg, targetLanguage);
        const [translatedMsg] = yield translate.translate(msg, targetLanguage);
        logs.translateMsgComplete(msg, targetLanguage);
        return translatedMsg;
    }
    catch (err) {
        logs.translateMsgError(msg, targetLanguage, err);
        throw err;
    }
});
const updateTranslations = (snapshot, translations) => __awaiter(this, void 0, void 0, function* () {
    logs.updateDocument(snapshot.ref.path);
    yield snapshot.ref.update(config_1.default.translationsFieldName, translations);
    logs.updateDocumentComplete(snapshot.ref.path);
});

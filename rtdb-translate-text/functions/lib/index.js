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
exports.rtdbtranslate = functions.handler.database.ref.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const changeType = getChangeType(change);
    try {
        switch (changeType) {
            case ChangeType.CREATE:
                yield handleCreateDocument(change.after);
                break;
            case ChangeType.DELETE:
                yield handleDeleteDocument(change.after);
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
    return snapshot.val();
};
const getChangeType = (change) => {
    if (!change.after.exists()) {
        return ChangeType.DELETE;
    }
    if (!change.before.exists()) {
        return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
};
const handleCreateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const msg = extractMsg(snapshot);
    if (msg.message) {
        if (msg.translated) {
            logs.documentCreatedAlreadyTranslated();
        }
        else {
            logs.documentCreatedWithMsg();
            yield translateDocument(snapshot);
        }
    }
    else {
        logs.documentCreatedNoMsg();
    }
});
const handleDeleteDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    logs.documentDeleted();
    yield removeTranslations(snapshot);
});
const handleUpdateDocument = (before, after) => __awaiter(this, void 0, void 0, function* () {
    const msgAfter = extractMsg(after);
    const msgBefore = extractMsg(before);
    if (msgAfter.translated) {
        logs.documentUpdatedAlreadyTranslated();
        return;
    }
    const msgHasChanged = msgAfter.message !== msgBefore.message;
    if (!msgHasChanged) {
        logs.documentUpdatedUnchangedMsg();
        return;
    }
    if (msgAfter.message) {
        logs.documentUpdatedChangedMsg();
        yield translateDocument(after);
    }
    else if (msgBefore.message) {
        logs.documentUpdatedDeletedMsg();
        yield removeTranslations(after);
    }
    else {
        logs.documentUpdatedNoMsg();
    }
});
const removeTranslations = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const translationsMap = config_1.default.languages.reduce((output, language) => {
        output[`${config_1.default.triggerPath}/${language}/${snapshot.key}`] = null;
        return output;
    }, {});
    yield updateTranslations(snapshot, translationsMap);
});
const translateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const message = extractMsg(snapshot);
    logs.translateMsgAllLanguages(message.message, config_1.default.languages);
    const tasks = config_1.default.languages.map((targetLanguage) => __awaiter(this, void 0, void 0, function* () {
        const translatedMsg = yield translateMessage(message.message, targetLanguage);
        return {
            language: targetLanguage,
            message: translatedMsg,
            translated: true,
        };
    }));
    try {
        const translations = yield Promise.all(tasks);
        logs.translateMsgAllLanguagesComplete(message.message);
        const translationsMap = translations.reduce((output, translation) => {
            output[`${config_1.default.triggerPath}/${translation.language}/${snapshot.key}`] = translation;
            return output;
        }, {});
        yield updateTranslations(snapshot, translationsMap);
    }
    catch (err) {
        logs.translateMsgAllLanguagesError(message.message, err);
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
const updateTranslations = (snapshot, translationsMap) => __awaiter(this, void 0, void 0, function* () {
    logs.updateDocument(snapshot.key);
    yield admin
        .database()
        .ref()
        .update(translationsMap);
    logs.updateDocumentComplete(snapshot.key);
});

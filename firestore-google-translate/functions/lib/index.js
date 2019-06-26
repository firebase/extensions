"use strict";
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
const translate = new translate_1.Translate({ projectId: process.env.PROJECT_ID });
// languages to be translated into
const LANGUAGES = process.env.LANGUAGES.split(",");
const MESSAGE_FIELD_NAME = process.env.MESSAGE_FIELD_NAME;
const TRANSLATIONS_FIELD_NAME = process.env.TRANSLATIONS_FIELD_NAME;
// Initializing firebase-admin
admin.initializeApp();
// Translate an incoming message.
exports.fstranslate = functions.handler.firestore.document.onWrite((change) => {
    if (!change.after.exists) {
        // Document was deleted, ignore
        console.log("Document was deleted, ignoring");
        return;
    }
    else if (!change.before.exists) {
        // Document was created, check if message exists
        const msg = change.after.get(MESSAGE_FIELD_NAME);
        if (msg) {
            console.log("Document was created with message, translating");
            return translateDocument(change.after);
        }
        else {
            console.log("Document was created without a message, skipping");
            return;
        }
    }
    else {
        // Document was updated, check if message has changed
        const msgAfter = change.after.get(MESSAGE_FIELD_NAME);
        const msgBefore = change.before.get(MESSAGE_FIELD_NAME);
        if (msgAfter === msgBefore) {
            console.log("Document was updated, but message has not changed, skipping");
            return;
        }
        if (msgAfter) {
            console.log("Document was updated, message has changed, translating");
            return translateDocument(change.after);
        }
        else {
            console.log("Document was updated, no message exists, skipping");
            return;
        }
    }
});
const translateDocument = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const message = snapshot.get(MESSAGE_FIELD_NAME);
    const tasks = LANGUAGES.map((targetLanguage) => __awaiter(this, void 0, void 0, function* () {
        const translatedMsg = yield translateMessage(message, targetLanguage);
        return {
            language: targetLanguage,
            message: translatedMsg,
        };
    }));
    const translations = yield Promise.all(tasks);
    const translationsMap = translations.reduce((output, translation) => {
        output[translation.language] = translation.message;
        return output;
    }, {});
    // Update the document
    yield snapshot.ref.update(TRANSLATIONS_FIELD_NAME, translationsMap);
});
const translateMessage = (msg, targetLanguage) => __awaiter(this, void 0, void 0, function* () {
    const [translatedMsg] = yield translate.translate(msg, targetLanguage);
    return translatedMsg;
});

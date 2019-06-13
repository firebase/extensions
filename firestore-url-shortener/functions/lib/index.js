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
const bitly_1 = require("bitly");
const bitly = new bitly_1.BitlyClient(process.env.ACCESS_TOKEN);
const SHORT_URL_FIELD_NAME = process.env.SHORT_URL_FIELD_NAME;
const URL_FIELD_NAME = process.env.URL_FIELD_NAME;
// Initializing firebase-admin
admin.initializeApp();
// Shorten an incoming URL.
exports.urlshortener = functions.handler.firestore.document.onWrite((change) => {
    if (!change.after.exists) {
        // Document was deleted, ignore
        console.log("Document was deleted, skipping");
        return Promise.resolve();
    }
    else if (!change.before.exists) {
        // Document was created, check if URL exists
        const url = change.before.get(URL_FIELD_NAME);
        if (url) {
            console.log("Document was created with URL, shortening");
            return shortenUrl(change.after);
        }
        else {
            console.log("Document was created without a URL, skipping");
            return Promise.resolve();
        }
    }
    else {
        // Document was updated, check if URL has changed
        const urlAfter = change.after.get(URL_FIELD_NAME);
        const urlBefore = change.before.get(URL_FIELD_NAME);
        if (urlAfter === urlBefore) {
            console.log("Document was updated, URL has not changed, skipping");
            return Promise.resolve();
        }
        if (urlAfter) {
            console.log("Document was updated, URL has changed, shortening");
            return shortenUrl(change.after);
        }
        else {
            console.log("Document was updated, no URL exists, skipping");
            return Promise.resolve();
        }
    }
});
const shortenUrl = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const url = snapshot.get(URL_FIELD_NAME);
    const response = yield bitly.shorten(url);
    // Update the document
    return snapshot.ref.update(SHORT_URL_FIELD_NAME, response.url);
});

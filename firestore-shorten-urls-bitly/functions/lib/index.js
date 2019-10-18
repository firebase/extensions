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
const grpc = require("grpc");
const bitly_1 = require("bitly");
const config_1 = require("./config");
const logs = require("./logs");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (ChangeType = {}));
const bitly = new bitly_1.BitlyClient(config_1.default.bitlyAccessToken);
// Initialize the Firebase Admin SDK
admin.initializeApp();
// Workaround for cold start issue (https://github.com/firebase/extensions/issues/48).
// Remove this line when INTERNAL BUG 138705198 is resolved.
admin.firestore().settings({ grpc });
logs.init();
exports.fsurlshortener = functions.handler.firestore.document.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    if (config_1.default.urlFieldName === config_1.default.shortUrlFieldName) {
        logs.fieldNamesNotDifferent();
        return;
    }
    const changeType = getChangeType(change);
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
        default: {
            throw new Error(`Invalid change type: ${changeType}`);
        }
    }
    logs.complete();
}));
const extractUrl = (snapshot) => {
    return snapshot.get(config_1.default.urlFieldName);
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
    const url = extractUrl(snapshot);
    if (url) {
        logs.documentCreatedWithUrl();
        yield shortenUrl(snapshot);
    }
    else {
        logs.documentCreatedNoUrl();
    }
});
const handleDeleteDocument = () => {
    logs.documentDeleted();
};
const handleUpdateDocument = (before, after) => __awaiter(this, void 0, void 0, function* () {
    const urlAfter = extractUrl(after);
    const urlBefore = extractUrl(before);
    if (urlAfter === urlBefore) {
        logs.documentUpdatedUnchangedUrl();
    }
    else if (urlAfter) {
        logs.documentUpdatedChangedUrl();
        yield shortenUrl(after);
    }
    else if (urlBefore) {
        logs.documentUpdatedDeletedUrl();
        yield updateShortUrl(after, admin.firestore.FieldValue.delete());
    }
    else {
        logs.documentUpdatedNoUrl();
    }
});
const shortenUrl = (snapshot) => __awaiter(this, void 0, void 0, function* () {
    const url = extractUrl(snapshot);
    logs.shortenUrl(url);
    try {
        const response = yield bitly.shorten(url);
        const { url: shortUrl } = response;
        logs.shortenUrlComplete(shortUrl);
        yield updateShortUrl(snapshot, shortUrl);
    }
    catch (err) {
        logs.error(err);
    }
});
const updateShortUrl = (snapshot, url) => __awaiter(this, void 0, void 0, function* () {
    logs.updateDocument(snapshot.ref.path);
    yield snapshot.ref.update(config_1.default.shortUrlFieldName, url);
    logs.updateDocumentComplete(snapshot.ref.path);
});

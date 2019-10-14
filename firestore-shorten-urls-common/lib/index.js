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
const admin = require("firebase-admin");
const config_1 = require("./config");
exports.config = config_1.default;
const logs_1 = require("./logs");
exports.FirestoreUrlShortenerLogger = logs_1.FirestoreUrlShortenerLogger;
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (ChangeType = {}));
class FirestoreUrlShortener {
    constructor(urlFieldName, shortUrlFieldName) {
        this.urlFieldName = urlFieldName;
        this.shortUrlFieldName = shortUrlFieldName;
        this.logs = logs_1.logs;
        this.urlFieldName = urlFieldName;
        this.shortUrlFieldName = shortUrlFieldName;
        // Initialize the Firebase Admin SDK
        admin.initializeApp();
    }
    onDocumentWrite(change) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logs.start();
            if (this.urlFieldName === this.shortUrlFieldName) {
                this.logs.fieldNamesNotDifferent();
                return;
            }
            const changeType = this.getChangeType(change);
            switch (changeType) {
                case ChangeType.CREATE:
                    yield this.handleCreateDocument(change.after);
                    break;
                case ChangeType.DELETE:
                    this.handleDeleteDocument();
                    break;
                case ChangeType.UPDATE:
                    yield this.handleUpdateDocument(change.before, change.after);
                    break;
                default: {
                    throw new Error(`Invalid change type: ${changeType}`);
                }
            }
            this.logs.complete();
        });
    }
    extractUrl(snapshot) {
        return snapshot.get(this.urlFieldName);
    }
    ;
    getChangeType(change) {
        if (!change.after.exists) {
            return ChangeType.DELETE;
        }
        if (!change.before.exists) {
            return ChangeType.CREATE;
        }
        return ChangeType.UPDATE;
    }
    ;
    handleCreateDocument(snapshot) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.extractUrl(snapshot);
            if (url) {
                this.logs.documentCreatedWithUrl();
                yield this.shortenUrl(snapshot);
            }
            else {
                this.logs.documentCreatedNoUrl();
            }
        });
    }
    ;
    handleDeleteDocument() {
        this.logs.documentDeleted();
    }
    ;
    handleUpdateDocument(before, after) {
        return __awaiter(this, void 0, void 0, function* () {
            const urlAfter = this.extractUrl(after);
            const urlBefore = this.extractUrl(before);
            if (urlAfter === urlBefore) {
                this.logs.documentUpdatedUnchangedUrl();
            }
            else if (urlAfter) {
                this.logs.documentUpdatedChangedUrl();
                yield this.shortenUrl(after);
            }
            else if (urlBefore) {
                this.logs.documentUpdatedDeletedUrl();
                yield this.updateShortUrl(after, admin.firestore.FieldValue.delete());
            }
            else {
                this.logs.documentUpdatedNoUrl();
            }
        });
    }
    ;
    updateShortUrl(snapshot, url) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logs.updateDocument(snapshot.ref.path);
            yield snapshot.ref.update(this.shortUrlFieldName, url);
            this.logs.updateDocumentComplete(snapshot.ref.path);
        });
    }
    ;
}
exports.FirestoreUrlShortener = FirestoreUrlShortener;

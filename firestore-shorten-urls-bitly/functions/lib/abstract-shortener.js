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
exports.FirestoreUrlShortener = void 0;
const admin = require("firebase-admin");
const logs = require("./logs");
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
        this.logs = logs;
        this.urlFieldName = urlFieldName;
        this.shortUrlFieldName = shortUrlFieldName;
        // Initialize the Firebase Admin SDK
        admin.initializeApp();
    }
    async onDocumentWrite(change) {
        this.logs.start();
        if (this.urlFieldName === this.shortUrlFieldName) {
            this.logs.fieldNamesNotDifferent();
            return;
        }
        const changeType = this.getChangeType(change);
        switch (changeType) {
            case ChangeType.CREATE:
                await this.handleCreateDocument(change.after);
                break;
            case ChangeType.DELETE:
                this.handleDeleteDocument();
                break;
            case ChangeType.UPDATE:
                await this.handleUpdateDocument(change.before, change.after);
                break;
            default: {
                throw new Error(`Invalid change type: ${changeType}`);
            }
        }
        this.logs.complete();
    }
    extractUrl(snapshot) {
        return snapshot.get(this.urlFieldName);
    }
    getChangeType(change) {
        if (!change.after.exists) {
            return ChangeType.DELETE;
        }
        if (!change.before.exists) {
            return ChangeType.CREATE;
        }
        return ChangeType.UPDATE;
    }
    async handleCreateDocument(snapshot) {
        const url = this.extractUrl(snapshot);
        if (url) {
            this.logs.documentCreatedWithUrl();
            await this.shortenUrl(snapshot);
        }
        else {
            this.logs.documentCreatedNoUrl();
        }
    }
    handleDeleteDocument() {
        this.logs.documentDeleted();
    }
    async handleUpdateDocument(before, after) {
        const urlAfter = this.extractUrl(after);
        const urlBefore = this.extractUrl(before);
        if (urlAfter === urlBefore) {
            this.logs.documentUpdatedUnchangedUrl();
        }
        else if (urlAfter) {
            this.logs.documentUpdatedChangedUrl();
            await this.shortenUrl(after);
        }
        else if (urlBefore) {
            this.logs.documentUpdatedDeletedUrl();
            await this.updateShortUrl(after, admin.firestore.FieldValue.delete());
        }
        else {
            this.logs.documentUpdatedNoUrl();
        }
    }
    async updateShortUrl(snapshot, url) {
        this.logs.updateDocument(snapshot.ref.path);
        // Wrapping in transaction to allow for automatic retries (#48)
        await admin.firestore().runTransaction((transaction) => {
            transaction.update(snapshot.ref, this.shortUrlFieldName, url);
            return Promise.resolve();
        });
        this.logs.updateDocumentComplete(snapshot.ref.path);
    }
}
exports.FirestoreUrlShortener = FirestoreUrlShortener;

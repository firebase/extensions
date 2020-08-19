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
exports.clearData = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const firebase_tools = require("firebase-tools");
const config_1 = require("./config");
const logs = require("./logs");
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
/*
 * The clearData function removes personal data from the RealTime Database,
 * Storage, and Firestore. It waits for all deletions to complete, and then
 * returns a success message.
 */
exports.clearData = functions.auth.user().onDelete((user) => __awaiter(void 0, void 0, void 0, function* () {
    logs.start();
    const { firestorePaths, rtdbPaths, storagePaths } = config_1.default;
    const { uid } = user;
    const promises = [];
    if (firestorePaths) {
        promises.push(clearFirestoreData(firestorePaths, uid));
    }
    else {
        logs.firestoreNotConfigured();
    }
    if (rtdbPaths) {
        promises.push(clearDatabaseData(rtdbPaths, uid));
    }
    else {
        logs.rtdbNotConfigured();
    }
    if (storagePaths) {
        promises.push(clearStorageData(storagePaths, uid));
    }
    else {
        logs.storageNotConfigured();
    }
    yield Promise.all(promises);
    logs.complete(uid);
}));
const clearDatabaseData = (databasePaths, uid) => __awaiter(void 0, void 0, void 0, function* () {
    logs.rtdbDeleting();
    const paths = extractUserPaths(databasePaths, uid);
    const promises = paths.map((path) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            logs.rtdbPathDeleting(path);
            yield admin
                .database()
                .ref(path)
                .remove();
            logs.rtdbPathDeleted(path);
        }
        catch (err) {
            logs.rtdbPathError(path, err);
        }
    }));
    yield Promise.all(promises);
    logs.rtdbDeleted();
});
const clearStorageData = (storagePaths, uid) => __awaiter(void 0, void 0, void 0, function* () {
    logs.storageDeleting();
    const paths = extractUserPaths(storagePaths, uid);
    const promises = paths.map((path) => __awaiter(void 0, void 0, void 0, function* () {
        const parts = path.split("/");
        const bucketName = parts[0];
        const bucket = bucketName === "{DEFAULT}"
            ? admin.storage().bucket()
            : admin.storage().bucket(bucketName);
        const prefix = parts.slice(1).join("/");
        try {
            logs.storagePathDeleting(prefix);
            yield bucket.deleteFiles({
                prefix,
            });
            logs.storagePathDeleted(prefix);
        }
        catch (err) {
            if (err.code === 404) {
                logs.storagePath404(prefix);
            }
            else {
                logs.storagePathError(prefix, err);
            }
        }
    }));
    yield Promise.all(promises);
    logs.storageDeleted();
});
const clearFirestoreData = (firestorePaths, uid) => __awaiter(void 0, void 0, void 0, function* () {
    logs.firestoreDeleting();
    const paths = extractUserPaths(firestorePaths, uid);
    const promises = paths.map((path) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const isRecursive = config_1.default.firestoreDeleteMode === "recursive";
            if (!isRecursive) {
                const firestore = admin.firestore();
                logs.firestorePathDeleting(path, false);
                // Wrapping in transaction to allow for automatic retries (#48)
                yield firestore.runTransaction((transaction) => {
                    transaction.delete(firestore.doc(path));
                    return Promise.resolve();
                });
                logs.firestorePathDeleted(path, false);
            }
            else {
                logs.firestorePathDeleting(path, true);
                yield firebase_tools.firestore.delete(path, {
                    project: process.env.PROJECT_ID,
                    recursive: true,
                    yes: true,
                });
                logs.firestorePathDeleted(path, true);
            }
        }
        catch (err) {
            logs.firestorePathError(path, err);
        }
    }));
    yield Promise.all(promises);
    logs.firestoreDeleted();
});
const extractUserPaths = (paths, uid) => {
    return paths.split(",").map((path) => replaceUID(path, uid));
};
const replaceUID = (path, uid) => {
    return path.replace(/{UID}/g, uid);
};

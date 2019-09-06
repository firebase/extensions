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
const config_1 = require("./config");
const logs = require("./logs");
const change_tracker_1 = require("./change_tracker");
const error_code_1 = require("./error_code");
admin.initializeApp();
const firestore = admin.firestore();
firestore.settings({ timestampsInSnapshots: true });
logs.init();
exports.fsdocumenthistories = functions.handler.firestore.document.onWrite((change, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const documentId = context.resource.name;
        const timestamp = change_tracker_1.getTimestamp(context, change);
        const data = change_tracker_1.getData(change);
        const historyDocKey = `${config_1.default.collectionPath}/${documentId}/${config_1.default.subCollectionId}/${timestamp.getTime()}`;
        logs.insertingHistory(historyDocKey, change_tracker_1.getChangeType(change));
        yield firestore.doc(historyDocKey).set(data);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
        switch (err.code) {
            case error_code_1.Status.DEADLINE_EXCEEDED:
            case error_code_1.Status.ABORTED:
                throw err; // Make function retry.
        }
    }
}));

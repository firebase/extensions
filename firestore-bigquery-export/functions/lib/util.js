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
exports.getDocumentId = exports.getChangeType = void 0;
const firestore_bigquery_change_tracker_1 = require("@firebaseextensions/firestore-bigquery-change-tracker");
function getChangeType(change) {
    if (!change.after.exists) {
        return firestore_bigquery_change_tracker_1.ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return firestore_bigquery_change_tracker_1.ChangeType.CREATE;
    }
    return firestore_bigquery_change_tracker_1.ChangeType.UPDATE;
}
exports.getChangeType = getChangeType;
function getDocumentId(change) {
    if (change.after.exists) {
        return change.after.id;
    }
    return change.before.id;
}
exports.getDocumentId = getDocumentId;

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
const functions = require("firebase-functions");
const bigquery_1 = require("./bigquery");
const config_1 = require("./config");
const firestoreEventHistoryTracker_1 = require("./firestoreEventHistoryTracker");
const logs = require("./logs");
let eventTracker = new bigquery_1.FirestoreBigQueryEventHistoryTracker(config_1.default);
logs.init();
exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite((change, context) => __awaiter(void 0, void 0, void 0, function* () {
    logs.start();
    try {
        const changeType = firestoreEventHistoryTracker_1.getChangeType(change);
        yield eventTracker.record([{
                timestamp: firestoreEventHistoryTracker_1.getTimestamp(context, change),
                operation: changeType,
                documentName: context.resource.name,
                eventId: context.eventId,
                data: changeType == firestoreEventHistoryTracker_1.ChangeType.DELETE ? undefined : change.after.data(),
            }]);
        logs.complete();
    }
    catch (err) {
        logs.error(err);
        logs.error(err.errors[0]);
    }
}));

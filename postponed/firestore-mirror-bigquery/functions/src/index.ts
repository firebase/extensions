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

import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";
import * as _ from "lodash";

import { FirestoreBigQueryEventHistoryTracker }  from "./bigquery";
import config from "./config";
import {  FirestoreSchema } from "./firestore";
import { ChangeType, getChangeType, FirestoreEventHistoryTracker, getTimestamp } from './firestoreEventHistoryTracker';
import * as logs from "./logs";
import { extractTimestamp } from "./util";

let eventTracker: FirestoreEventHistoryTracker = new FirestoreBigQueryEventHistoryTracker(config);

logs.init();

exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    logs.start();
    try {
      const changeType = getChangeType(change);
      await eventTracker.record([{
        timestamp: getTimestamp(context, change),
        operation: changeType,
        documentName: context.resource.name,
        eventId: context.eventId,
        data: changeType == ChangeType.DELETE ? undefined: change.after.data(),
      }]);
      logs.complete();
    } catch (err) {
      logs.error(err);
      logs.error(err.errors[0]);
    }
  }
);


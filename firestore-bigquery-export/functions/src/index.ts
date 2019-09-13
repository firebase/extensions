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

import config from "./config";
import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreEventHistoryTracker,
  FirestoreSchema,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as _ from "lodash";
import * as logs from "./logs";
import {
  getChangeType,
  getTimestamp,
} from "./util";

const eventTracker: FirestoreEventHistoryTracker = new FirestoreBigQueryEventHistoryTracker(config);

logs.init();

exports.fsexportbigquery = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    logs.start();
    try {
      const changeType = getChangeType(change);
      await eventTracker.record([{
        timestamp: context.timestamp,
        operation: changeType,
        documentName: context.resource.name,
        eventId: context.eventId,
        data: changeType == ChangeType.DELETE ? undefined: change.after.data(),
      }]);
      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

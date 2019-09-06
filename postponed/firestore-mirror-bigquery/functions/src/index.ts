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
import { extractSnapshotData, FirestoreSchema } from "./firestore";
import { ChangeType, FirestoreEventHistoryTracker } from './firestoreEventHistoryTracker';
import * as logs from "./logs";
import {
  extractTimestamp,
} from "./util";

// TODO: How can we load a file dynamically?
const schemaFile = require("../schema.json");

let eventTracker: FirestoreEventHistoryTracker = new FirestoreBigQueryEventHistoryTracker(config);

logs.init();

exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    logs.start();

    try {
      // @ts-ignore string not assignable to enum
      const schema: FirestoreSchema = schemaFile;
      const { fields, timestampField } = schema;

      // Identify the operation and data to be inserted
      let data;
      let defaultTimestamp: string;
      let snapshot: firebase.firestore.DocumentSnapshot;
      let operation;

      const changeType = getChangeType(change);
      switch (changeType) {
        case ChangeType.INSERT:
          operation = "INSERT";
          snapshot = change.after;
          defaultTimestamp = snapshot.createTime
            ? snapshot.createTime.toDate().toISOString()
            : context.timestamp;
          break;
        case ChangeType.DELETE:
          operation = "DELETE";
          snapshot = change.before;
          data = extractSnapshotData(snapshot, fields);
          defaultTimestamp = context.timestamp;
          break;
        case ChangeType.UPDATE:
          operation = "UPDATE";
          snapshot = change.after;
          data = extractSnapshotData(snapshot, fields);
          defaultTimestamp = snapshot.updateTime
            ? snapshot.updateTime.toDate().toISOString()
            : context.timestamp;
          break;
        default: {
          throw new Error(`Invalid change type: ${changeType}`);
        }
      }

      const timestamp = extractTimestamp(
        data,
        defaultTimestamp,
        timestampField
      );

      await eventTracker.record([{
        timestamp: timestamp,
        operation: changeType,
        name: context.resource.name,
        documentId: snapshot.ref.id,
        eventId: context.eventId,
        data: data,
      }]);

      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

function getChangeType(
  change: functions.Change<firebase.firestore.DocumentSnapshot>
): ChangeType {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.INSERT;
  }
  return ChangeType.UPDATE;
};

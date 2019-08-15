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

import { buildDataRow, initializeSchema, insertData } from "./bigquery";
import config from "./config";
import { extractSnapshotData, FirestoreSchema } from "./firestore";
import * as logs from "./logs";
import {
  extractIdFieldNames,
  extractIdFieldValues,
  extractTimestamp,
} from "./util";

enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

export interface ExportDataSink {
  insert(timestamp: string, operation: string, eventId: string, idFields: string[], data: Object);
}

// TODO: How can we load a file dynamically?
const schemaFile = require("../schema.json");

// Flag to indicate if the BigQuery schema has been initialized.
// This is a work around to prevent the need to run the initialization on every
// function execution and instead restricts the initialization to cold starts
// of the function.
let isSchemainitialized = false;

logs.init();

exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    logs.start();

    try {
      // @ts-ignore string not assignable to enum
      const schema: FirestoreSchema = schemaFile;
      const { fields, timestampField } = schema;

      // Is the collection path for a sub-collection and does the collection path
      // contain any wildcard parameters
      // NOTE: This is a workaround as `context.params` is not available in the
      // `.handler` namespace
      const idFieldNames = extractIdFieldNames(config.collectionPath);

      // This initialization should be moved to `mod install` if Mods adds support
      // for executing code as part of the install process
      // Currently it runs on every cold start of the function
      if (!isSchemainitialized) {
        await initializeSchema(
          config.datasetId,
          config.tableName,
          schema,
          idFieldNames
        );
        isSchemainitialized = true;
      }

      // Identify the operation and data to be inserted
      let data;
      let defaultTimestamp: string;
      let snapshot: firebase.firestore.DocumentSnapshot;
      let operation;

      const changeType = getChangeType(change);
      switch (changeType) {
        case ChangeType.CREATE:
          operation = "INSERT";
          snapshot = change.after;
          data = extractSnapshotData(snapshot, fields);
          defaultTimestamp = snapshot.createTime
            ? snapshot.createTime.toDate().toISOString()
            : context.timestamp;
          break;
        case ChangeType.DELETE:
          operation = "DELETE";
          snapshot = change.before;
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

      // Extract the values of any `idFieldNames` specifed in the collection path
      const { idFieldValues } = extractIdFieldValues(snapshot, idFieldNames);

      // Extract the timestamp, or use either the snapshot metadata or the event timestamp as a default
      const timestamp = extractTimestamp(
        data,
        defaultTimestamp,
        timestampField
      );
      // Build the row of data to insert into BigQuery
      const row = buildDataRow(
        idFieldValues,
        // Use the function's event ID to protect against duplicate executions
        context.eventId,
        operation,
        timestamp,
        data
      );
      await insertData(config.datasetId, config.tableName, row);

      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

const getChangeType = (
  change: functions.Change<firebase.firestore.DocumentSnapshot>
) => {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

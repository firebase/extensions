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
import * as functions from "firebase-functions";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreEventHistoryTracker,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

import * as admin from "firebase-admin";
import { getEventarc } from "firebase-admin/eventarc";
import * as logs from "./logs";
import { getChangeType, getDocumentId } from "./util";

const eventTracker: FirestoreEventHistoryTracker =
  new FirestoreBigQueryEventHistoryTracker({
    tableId: config.tableId,
    datasetId: config.datasetId,
    datasetLocation: config.datasetLocation,
    backupTableId: config.backupCollectionId,
    transformFunction: config.transformFunction,
    timePartitioning: config.timePartitioning,
    timePartitioningField: config.timePartitioningField,
    timePartitioningFieldType: config.timePartitioningFieldType,
    timePartitioningFirestoreField: config.timePartitioningFirestoreField,
    clustering: config.clustering,
    wildcardIds: config.wildcardIds,
    bqProjectId: config.bqProjectId,
    useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
  });

logs.init();

/** Init app, if not already initialized */
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const eventChannel =
  process.env.EVENTARC_CHANNEL &&
  getEventarc().channel(process.env.EVENTARC_CHANNEL, {
    allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
  });

exports.fsexportbigquery = functions.firestore
  .document(config.collectionPath)
  .onWrite(async (change, context) => {
    logs.start();
    try {
      const changeType = getChangeType(change);
      const documentId = getDocumentId(change);

      if (eventChannel) {
        await eventChannel.publish({
          type: `firebase.extensions.big-query-export.v1.sync.start`,
          data: {
            documentId,
            changeType,
            before: {
              data: change.before.data(),
            },
            after: {
              data: change.after.data(),
            },
            context: context.resource,
          },
        });
      }

      await eventTracker.record([
        {
          timestamp: context.timestamp, // This is a Cloud Firestore commit timestamp with microsecond precision.
          operation: changeType,
          documentName: context.resource.name,
          documentId: documentId,
          pathParams: config.wildcardIds ? context.params : null,
          eventId: context.eventId,
          data:
            changeType === ChangeType.DELETE ? undefined : change.after.data(),
          oldData:
            changeType === ChangeType.CREATE ? undefined : change.before.data(),
        },
      ]);
      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  });

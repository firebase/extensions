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
import * as admin from "firebase-admin";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreEventHistoryTracker,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

import * as admin from "firebase-admin";
import { getEventarc } from "firebase-admin/eventarc";
import * as logs from "./logs";
import { getChangeType, getDocumentId, resolveWildcardIds } from "./util";

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
admin.initializeApp();

const eventChannel =
  process.env.EVENTARC_CHANNEL &&
  getEventarc().channel(process.env.EVENTARC_CHANNEL, {
    allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
  });

if (!admin.apps.length) {
  admin.initializeApp();
  admin.firestore().settings({ ignoreUndefinedProperties: true });
}

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

exports.fsimportexistingdocs = functions.tasks
  .taskQueue()
  .onDispatch(async (data) => {
    const runtime = getExtensions().runtime();
    if (!config.doBackfill) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        "No existing documents imported into BigQuery."
      );
      return;
    }
    const offset = (data["offset"] as number) ?? 0;
    const docsCount = (data["docsCount"] as number) ?? 0;

    const query = config.useCollectionGroupQuery
      ? admin.firestore().collectionGroup(config.importCollectionPath)
      : admin.firestore().collection(config.importCollectionPath);
    const snapshot = await query
      .offset(offset)
      .limit(config.docsPerBackfill)
      .get();

    const rows = snapshot.docs.map((d) => {
      return {
        timestamp: new Date().toISOString(),
        operation: ChangeType.IMPORT,
        documentName: `projects/${config.bqProjectId}/databases/(default)/documents/${d.ref.path}`,
        documentId: d.id,
        eventId: "",
        pathParams: resolveWildcardIds(config.importCollectionPath, d.ref.path),
        data: d.data(),
      };
    });
    try {
      await eventTracker.record(rows);
    } catch (err: any) {
      // eventTracker will already try to write failures back to BACKUP_COLLECTION if configured.
      // TODO: Decide how this should behave/what this should log if BACKUP_COLLECTION is undefined.
      functions.logger.log(err);
    }
    if (rows.length == config.docsPerBackfill) {
      // There are more documents to import - enqueue another task to continue the backfill.
      const queue = getFunctions().taskQueue(
        "fsimportexistingdocs",
        process.env.EXT_INSTANCE_ID
      );
      await queue.enqueue({
        offset: offset + config.docsPerBackfill,
        docsCount: docsCount + rows.length,
      });
    } else {
      // We are finished, set the processing state to report back how many docs were imported.
      runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        `Successfully imported ${
          docsCount + rows.length
        } documents into BigQuery`
      );
    }
  });

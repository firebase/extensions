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
import { DocumentSnapshot } from "firebase-admin/firestore";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreEventHistoryTracker,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

import { getEventarc } from "firebase-admin/eventarc";
import * as logs from "./logs";
import * as events from "./events";
import { getChangeType, getDocumentId, resolveWildcardIds } from "./util";

const eventTrackerConfig = {
  tableId: config.tableId,
  datasetId: config.datasetId,
  datasetLocation: config.datasetLocation,
  backupTableId: config.backupCollectionId,
  transformFunction: config.transformFunction,
  timePartitioning: config.timePartitioning,
  timePartitioningField: config.timePartitioningField,
  timePartitioningFieldType: config.timePartitioningFieldType,
  timePartitioningFirestoreField: config.timePartitioningFirestoreField,
  databaseId: config.databaseId,
  clustering: config.clustering,
  wildcardIds: config.wildcardIds,
  bqProjectId: config.bqProjectId,
  useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
  skipInit: true,
  kmsKeyName: config.kmsKeyName,
};

const eventTracker: FirestoreEventHistoryTracker =
  new FirestoreBigQueryEventHistoryTracker(eventTrackerConfig);

logs.init();

/** Init app, if not already initialized */
if (admin.apps.length === 0) {
  admin.initializeApp();
}

events.setupEventChannel();

export const syncBigQuery = functions.tasks
  .taskQueue()
  .onDispatch(
    async ({ context, changeType, documentId, data, oldData }, ctx) => {
      try {
        // Use the shared function to write the event to BigQuery
        await writeEventToBigQuery(
          changeType,
          documentId,
          data,
          oldData,
          context
        );

        // Record a success event in EventArc, if configured
        await events.recordSuccessEvent({
          subject: documentId,
          data: {
            timestamp: context.timestamp,
            operation: changeType,
            documentName: context.resource.name,
            documentId,
            pathParams: config.wildcardIds ? context.params : null,
            eventId: context.eventId,
            data,
            oldData,
          },
        });

        logs.complete();
      } catch (err) {
        logs.error(true, "Failed to process syncBigQuery task", err, {
          context,
          changeType,
          documentId,
          data,
          oldData,
        });
        throw err;
      }
    }
  );

export const fsexportbigquery = functions
  .runWith({ failurePolicy: true })
  .firestore.database(config.databaseId)
  .document(config.collectionPath)
  .onWrite(async (change, context) => {
    logs.start();
    const changeType = getChangeType(change);
    const documentId = getDocumentId(change);

    const isCreated = changeType === ChangeType.CREATE;
    const isDeleted = changeType === ChangeType.DELETE;

    const data = isDeleted ? undefined : change.after?.data();
    const oldData =
      isCreated || config.excludeOldData ? undefined : change.before?.data();

    let serializedData: any;
    let serializedOldData: any;

    try {
      serializedData = eventTracker.serializeData(data);
      serializedOldData = eventTracker.serializeData(oldData);
    } catch (err) {
      logs.error(true, "Failed to serialize data", err, { data, oldData });
      throw err;
    }

    try {
      await recordEventArcStartEvent(documentId, changeType, change, context);
    } catch (err) {
      logs.error(false, "Failed to record start event", err);
      throw err;
    }

    try {
      await writeEventToBigQuery(
        changeType,
        documentId,
        serializedData,
        serializedOldData,
        context
      );
    } catch (err) {
      await handleEnqueueError(
        err,
        context,
        changeType,
        documentId,
        serializedData,
        serializedOldData
      );
    }

    logs.complete();
  });

/**
 * Record the start event for tracking purposes.
 */
async function recordEventArcStartEvent(
  documentId: string,
  changeType: string,
  change: functions.Change<DocumentSnapshot>,
  context: functions.EventContext
) {
  await events.recordStartEvent({
    documentId,
    changeType,
    before: { data: change.before.data() },
    after: { data: change.after.data() },
    context: context.resource,
  });
}

/**
 * Record the event to the event tracker.
 */
async function writeEventToBigQuery(
  changeType: string,
  documentId: string,
  serializedData: any,
  serializedOldData: any,
  context: functions.EventContext
) {
  const event = {
    timestamp: context.timestamp,
    operation: changeType,
    documentName: context.resource.name,
    documentId,
    pathParams: config.wildcardIds ? context.params : null,
    eventId: context.eventId,
    data: serializedData,
    oldData: serializedOldData,
  };

  eventTracker.record([event]);
}

/**
 * Handle errors when enqueueing tasks to sync BigQuery.
 */
async function handleEnqueueError(
  err: Error,
  context: functions.EventContext,
  changeType: string,
  documentId: string,
  serializedData: any,
  serializedOldData: any
) {
  try {
    const queue = getFunctions().taskQueue(
      `locations/${config.location}/functions/syncBigQuery`,
      config.instanceId
    );

    await queue.enqueue({
      context,
      changeType,
      documentId,
      data: serializedData,
      oldData: serializedOldData,
    });
  } catch (enqueueErr) {
    const event = {
      timestamp: context.timestamp,
      operation: changeType,
      documentName: context.resource.name,
      documentId,
      pathParams: config.wildcardIds ? context.params : null,
      eventId: context.eventId,
      data: serializedData,
      oldData: serializedOldData,
    };

    await events.recordErrorEvent(enqueueErr as Error);

    if (!enqueueErr.logged) {
      logs.error(
        true,
        "Failed to enqueue task to syncBigQuery",
        enqueueErr,
        event
      );
    }
  }
}

export const setupBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    /** Setup runtime environment */
    const runtime = getExtensions().runtime();

    /** Init the BigQuery sync */
    await eventTracker.initialize();

    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
  });

export const initBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    /** Setup runtime environment */
    const runtime = getExtensions().runtime();

    /** Init the BigQuery sync */
    await eventTracker.initialize();

    /** Run Backfill */
    if (false) {
      await getFunctions()
        .taskQueue(
          `locations/${config.location}/functions/fsimportexistingdocs`,
          config.instanceId
        )
        .enqueue({ offset: 0, docsCount: 0 });
      return;
    }

    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
    return;
  });

exports.fsimportexistingdocs = functions.tasks
  .taskQueue()
  .onDispatch(async (data, context) => {
    const runtime = getExtensions().runtime();
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Completed. No existing documents imported into BigQuery."
    );
    return;

    // if (!config.doBackfill || !config.importCollectionPath) {
    //   await runtime.setProcessingState(
    //     "PROCESSING_COMPLETE",
    //     "Completed. No existing documents imported into BigQuery."
    //   );
    //   return;
    // }

    // const offset = (data["offset"] as number) ?? 0;
    // const docsCount = (data["docsCount"] as number) ?? 0;

    // const query = config.useCollectionGroupQuery
    //   ? getFirestore(config.databaseId).collectionGroup(
    //       config.importCollectionPath.split("/")[
    //         config.importCollectionPath.split("/").length - 1
    //       ]
    //     )
    //   : getFirestore(config.databaseId).collection(config.importCollectionPath);

    // const snapshot = await query
    //   .offset(offset)
    //   .limit(config.docsPerBackfill)
    //   .get();

    // const rows = snapshot.docs.map((d) => {
    //   return {
    //     timestamp: new Date().toISOString(),
    //     operation: ChangeType.IMPORT,
    //     documentName: `projects/${config.bqProjectId}/databases/(default)/documents/${d.ref.path}`,
    //     documentId: d.id,
    //     eventId: "",
    //     pathParams: resolveWildcardIds(config.importCollectionPath, d.ref.path),
    //     data: eventTracker.serializeData(d.data()),
    //   };
    // });
    // try {
    //   await eventTracker.record(rows);
    // } catch (err: any) {
    //   /** If configured, event tracker wil handle failed rows in a backup collection  */
    //   functions.logger.log(err);
    // }
    // if (rows.length == config.docsPerBackfill) {
    //   // There are more documents to import - enqueue another task to continue the backfill.
    //   const queue = getFunctions().taskQueue(
    //     `locations/${config.location}/functions/fsimportexistingdocs`,
    //     config.instanceId
    //   );
    //   await queue.enqueue({
    //     offset: offset + config.docsPerBackfill,
    //     docsCount: docsCount + rows.length,
    //   });
    // } else {
    //   // We are finished, set the processing state to report back how many docs were imported.
    //   runtime.setProcessingState(
    //     "PROCESSING_COMPLETE",
    //     `Successfully imported ${
    //       docsCount + rows.length
    //     } documents into BigQuery`
    //   );
    // }
    // await events.recordCompletionEvent({ context });
  });

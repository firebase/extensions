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
import * as functions from "firebase-functions/v1";
import {
  onDocumentWritten,
  FirestoreEvent,
} from "firebase-functions/firestore";

import * as admin from "firebase-admin";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";
import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

import * as logs from "./logs";
import * as events from "./events";
import { getChangeType, getDocumentId } from "./util";
import { DocumentSnapshot } from "firebase-admin/firestore";

// Configuration for the Firestore Event History Tracker.
const eventTrackerConfig = {
  firestoreInstanceId: config.databaseId,
  tableId: config.tableId,
  datasetId: config.datasetId,
  datasetLocation: config.datasetLocation,
  backupTableId: config.backupCollectionId,
  transformFunction: config.transformFunction,
  timePartitioning: config.timePartitioning,
  timePartitioningField: config.timePartitioningField,
  timePartitioningFieldType: config.timePartitioningFieldType,
  timePartitioningFirestoreField: config.timePartitioningFirestoreField,
  // Database related configurations
  databaseId: config.databaseId,
  clustering: config.clustering,
  wildcardIds: config.wildcardIds,
  bqProjectId: config.bqProjectId,
  // Optional configurations
  useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
  skipInit: true,
  kmsKeyName: config.kmsKeyName,
  // View configurations
  useMaterializedView:
    config.viewType === "materialized_incremental" ||
    config.viewType === "materialized_non_incremental",
  useIncrementalMaterializedView:
    config.viewType === "materialized_incremental",
  maxStaleness: config.maxStaleness,
  refreshIntervalMinutes: config.refreshIntervalMinutes,
  logLevel: config.logLevel,
};

// Initialize the Firestore Event History Tracker with the given configuration.
const eventTracker: FirestoreBigQueryEventHistoryTracker =
  new FirestoreBigQueryEventHistoryTracker(eventTrackerConfig);

// Initialize logging.
logs.logger.setLogLevel(config.logLevel);
logs.init();

/** Initialize Firebase Admin SDK if not already initialized */
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Setup the event channel for EventArc.
events.setupEventChannel();

/**
 * Cloud Function to handle enqueued tasks to synchronize Firestore changes to BigQuery.
 */
export const syncBigQuery = functions.tasks
  .taskQueue()
  .onDispatch(
    async ({ context, changeType, documentId, data, oldData }, ctx) => {
      const documentName = context.resource.name;
      const eventId = context.eventId;
      const operation = changeType;

      logs.logEventAction(
        "Firestore event received by onDispatch trigger",
        documentName,
        eventId,
        operation
      );

      try {
        // Use the shared function to write the event to BigQuery
        await recordEventToBigQuery(
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

        // Log completion of the task.
        logs.complete();
      } catch (err) {
        // Log error and throw it to handle in the calling function.
        logs.logFailedEventAction(
          "Failed to write event to BigQuery from onDispatch handler",
          documentName,
          eventId,
          operation,
          err as Error
        );

        throw err;
      }
    }
  );

export const fsexportbigquery = onDocumentWritten(
  `${config.collectionPath}/{documentId}`,
  async (event) => {
    const { data, ...context } = event;

    // Start logging the function execution.
    logs.start();

    // Determine the type of change (CREATE, UPDATE, DELETE) from the new event data.
    const changeType = getChangeType(data);
    const documentId = getDocumentId(data);

    // Check if the document is newly created or deleted.
    const isCreated = changeType === ChangeType.CREATE;
    const isDeleted = changeType === ChangeType.DELETE;

    // Get the new and old data from the snapshot.
    const newData = isDeleted ? undefined : data.after.data();
    const oldData =
      isCreated || config.excludeOldData ? undefined : data.before.data();

    // check this is the full doc name
    const documentName = context.document;
    const eventId = context.id;
    const operation = changeType;

    logs.logEventAction(
      "Firestore event received by onDocumentWritten trigger",
      documentName,
      eventId,
      operation
    );

    let serializedData: any;
    let serializedOldData: any;

    try {
      // Serialize the data before processing.
      serializedData = eventTracker.serializeData(newData);
      serializedOldData = eventTracker.serializeData(oldData);
    } catch (err) {
      logs.logFailedEventAction(
        "Failed to serialize data",
        documentName,
        eventId,
        operation,
        err as Error
      );
      throw err;
    }

    try {
      // Record the start event in EventArc, if configured.
      await events.recordStartEvent({
        documentId,
        changeType,
        before: { data: data.before.data() },
        after: { data: data.after.data() },
        context,
      });
    } catch (err) {
      logs.error(false, "Failed to record start event", err);
      throw err;
    }

    try {
      // Write the change event to BigQuery.
      await recordEventToBigQuery(
        changeType,
        documentId,
        serializedData,
        serializedOldData,
        event
      );
    } catch (err) {
      logs.failedToWriteToBigQueryImmediately(err as Error);
      // Handle enqueue errors with retries and backup to GCS.
      await attemptToEnqueue(
        err,
        event,
        changeType,
        documentId,
        serializedData,
        serializedOldData
      );
    }

    // Log the successful completion of the function.
    logs.complete();
  }
);

/**
 * Record the event to the Firestore Event History Tracker and BigQuery.
 *
 * @param changeType - The type of change (CREATE, UPDATE, DELETE).
 * @param documentId - The ID of the Firestore document.
 * @param serializedData - The serialized new data of the document.
 * @param serializedOldData - The serialized old data of the document.
 * @param context - The event context from Firestore.
 */
async function recordEventToBigQuery(
  changeType: ChangeType,
  documentId: string,
  serializedData: any,
  serializedOldData: any,
  // TODO: fix types, do we want the whole event here? probably not
  context: FirestoreEvent<
    functions.Change<DocumentSnapshot>,
    {
      documentId: string;
    }
  >
) {
  const event: FirestoreDocumentChangeEvent = {
    timestamp: context.time, // Cloud Firestore commit timestamp
    operation: changeType, // The type of operation performed
    documentName: context.document, // The document name
    documentId, // The document ID
    pathParams: (config.wildcardIds ? context.params : null) as
      | FirestoreDocumentChangeEvent["pathParams"]
      | null, // Path parameters, if any
    eventId: context.id, // The event ID from Firestore
    data: serializedData, // Serialized new data
    oldData: serializedOldData, // Serialized old data
  };

  // Record the event in the Firestore Event History Tracker and BigQuery.
  await eventTracker.record([event]);
}

/**
 * Handle errors when enqueueing tasks to sync BigQuery.
 *
 * @param err - The error object.
 * @param context - The event context from Firestore.
 * @param changeType - The type of change (CREATE, UPDATE, DELETE).
 * @param documentId - The ID of the Firestore document.
 * @param serializedData - The serialized new data of the document.
 * @param serializedOldData - The serialized old data of the document.
 */
async function attemptToEnqueue(
  _err: Error,
  // TODO: fix types, do we want the whole event here? probably not
  context: FirestoreEvent<
    functions.Change<DocumentSnapshot>,
    {
      documentId: string;
    }
  >,
  changeType: ChangeType,
  documentId: string,
  serializedData: any,
  serializedOldData: any
) {
  try {
    const queue = getFunctions().taskQueue(
      `locations/${config.location}/functions/syncBigQuery`,
      config.instanceId
    );

    let attempts = 0;
    const jitter = Math.random() * 100; // Adding jitter to avoid collision

    // Exponential backoff formula with a maximum of 5 + jitter seconds
    const backoff = (attempt: number) =>
      Math.min(Math.pow(2, attempt) * 100, 5000) + jitter;

    while (attempts < config.maxEnqueueAttempts) {
      if (attempts > 0) {
        // Wait before retrying to enqueue the task.
        await new Promise((resolve) => setTimeout(resolve, backoff(attempts)));
      }

      attempts++;
      try {
        // Attempt to enqueue the task to the queue.
        await queue.enqueue({
          context,
          changeType,
          documentId,
          data: serializedData,
          oldData: serializedOldData,
        });
        break; // Break the loop if enqueuing is successful.
      } catch (enqueueErr) {
        // Throw the error if max attempts are reached.
        if (attempts === config.maxEnqueueAttempts) {
          throw enqueueErr;
        }
      }
    }
  } catch (enqueueErr) {
    // Prepare the event object for error logging.

    // Record the error event.
    await events.recordErrorEvent(enqueueErr as Error);

    const documentName = context.document;
    const eventId = context.id;
    const operation = changeType;

    logs.logFailedEventAction(
      "Failed to enqueue event to Cloud Tasks from onWrite handler",
      documentName,
      eventId,
      operation,
      enqueueErr as Error
    );
  }
}

/**
 * Cloud Function to set up BigQuery sync by initializing the event tracker.
 */
export const setupBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    /** Setup runtime environment */
    const runtime = getExtensions().runtime();

    // Initialize the BigQuery sync.
    await eventTracker.initialize();

    // Update the processing state.
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
  });

/**
 * Cloud Function to initialize BigQuery sync.
 */
export const initBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    /** Setup runtime environment */
    const runtime = getExtensions().runtime();

    // Initialize the BigQuery sync.
    await eventTracker.initialize();

    // Update the processing state.
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
    return;
  });

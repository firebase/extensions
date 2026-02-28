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

// Configuration for the Firestore Event History Tracker
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

const eventTracker = new FirestoreBigQueryEventHistoryTracker(
  eventTrackerConfig
);

logs.logger.setLogLevel(config.logLevel);
logs.init();

if (admin.apps.length === 0) {
  admin.initializeApp();
}

events.setupEventChannel();

/**
 * Task data structure for BigQuery synchronization
 */
interface SyncBigQueryTaskData {
  timestamp: string;
  eventId: string;
  relativePath: string;
  fullResourceName: string;
  changeType: ChangeType;
  documentId: string;
  params: Record<string, any> | null;
  data: any;
  oldData: any;
}

/**
 * Handles enqueued tasks for syncing Firestore changes to BigQuery
 */
export const syncBigQuery = functions.tasks
  .taskQueue()
  .onDispatch(async (taskData: SyncBigQueryTaskData, ctx) => {
    const fullResourceName = taskData.fullResourceName;
    const eventId = taskData.eventId;
    const operation = taskData.changeType;

    logs.logEventAction(
      "Firestore event received by onDispatch trigger",
      fullResourceName,
      eventId,
      operation
    );

    try {
      await recordEventToBigQuery(
        taskData.changeType,
        taskData.documentId,
        taskData.fullResourceName,
        taskData.data,
        taskData.oldData,
        taskData
      );

      await events.recordSuccessEvent({
        subject: taskData.documentId,
        data: {
          timestamp: taskData.timestamp,
          operation: taskData.changeType,
          documentName: taskData.fullResourceName,
          documentId: taskData.documentId,
          pathParams: taskData.params,
          eventId: taskData.eventId,
          data: taskData.data,
          oldData: taskData.oldData,
        },
      });

      logs.complete();
    } catch (err) {
      logs.logFailedEventAction(
        "Failed to write event to BigQuery from onDispatch handler",
        fullResourceName,
        eventId,
        operation,
        err as Error
      );

      throw err;
    }
  });

/**
 * Main Cloud Function that triggers on Firestore document changes
 * and sends the data to BigQuery
 */
export const fsexportbigquery = onDocumentWritten(
  `${config.collectionPath}/{documentId}`,
  async (event) => {
    const { data, ...context } = event;
    logs.start();

    const changeType = getChangeType(data);
    const documentId = getDocumentId(data);
    const isCreated = changeType === ChangeType.CREATE;
    const isDeleted = changeType === ChangeType.DELETE;

    const newData = isDeleted ? undefined : data.after.data();
    const oldData =
      isCreated || config.excludeOldData ? undefined : data.before.data();

    const relativeName = context.document;
    const projectId = config.projectId;
    const fullResourceName = `projects/${projectId}/databases/${config.databaseId}/documents/${relativeName}`;
    const eventId = context.id;
    const operation = changeType;

    logs.logEventAction(
      "Firestore event received by onDocumentWritten trigger",
      fullResourceName,
      eventId,
      operation
    );

    let serializedData: any;
    let serializedOldData: any;

    try {
      serializedData = eventTracker.serializeData(newData);
      serializedOldData = eventTracker.serializeData(oldData);
    } catch (err) {
      logs.logFailedEventAction(
        "Failed to serialize data",
        fullResourceName,
        eventId,
        operation,
        err as Error
      );
      throw err;
    }

    try {
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
      await recordEventToBigQuery(
        changeType,
        documentId,
        fullResourceName,
        serializedData,
        serializedOldData,
        {
          timestamp: context.time,
          eventId: context.id,
          relativePath: context.document,
          fullResourceName,
          changeType,
          documentId,
          params: config.wildcardIds ? context.params : null,
          data: serializedData,
          oldData: serializedOldData,
        }
      );
    } catch (err) {
      logs.failedToWriteToBigQueryImmediately(err as Error);

      await attemptToEnqueue(err, {
        timestamp: context.time,
        eventId: context.id,
        relativePath: context.document,
        fullResourceName: fullResourceName,
        changeType,
        documentId,
        params: config.wildcardIds ? context.params : null,
        data: serializedData,
        oldData: serializedOldData,
      });
    }

    logs.complete();
  }
);

/**
 * Records a Firestore document change event to BigQuery
 *
 * @param changeType - The type of change (CREATE, UPDATE, DELETE)
 * @param documentId - The ID of the Firestore document
 * @param fullResourceName - Fully-qualified Firestore document path
 * @param serializedData - The serialized new data
 * @param serializedOldData - The serialized old data
 * @param taskData - Task metadata containing event information
 */
async function recordEventToBigQuery(
  changeType: ChangeType,
  documentId: string,
  fullResourceName: string,
  serializedData: any,
  serializedOldData: any,
  taskData: SyncBigQueryTaskData
) {
  const event: FirestoreDocumentChangeEvent = {
    timestamp: taskData.timestamp,
    operation: changeType,
    documentName: fullResourceName,
    documentId,
    pathParams: taskData.params as
      | FirestoreDocumentChangeEvent["pathParams"]
      | null,
    eventId: taskData.eventId,
    data: serializedData,
    oldData: serializedOldData,
  };

  await eventTracker.record([event]);
}

/**
 * Handles task enqueueing with retry logic when BigQuery sync fails
 *
 * @param err - The error that occurred
 * @param taskData - The task data to enqueue
 */
async function attemptToEnqueue(_err: Error, taskData: SyncBigQueryTaskData) {
  try {
    const queue = getFunctions().taskQueue(
      `locations/${config.location}/functions/syncBigQuery`,
      config.instanceId
    );

    let attempts = 0;
    const jitter = Math.random() * 100;
    const backoff = (attempt: number) =>
      Math.min(Math.pow(2, attempt) * 100, 5000) + jitter;

    while (attempts < config.maxEnqueueAttempts) {
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoff(attempts)));
      }

      attempts++;
      try {
        await queue.enqueue(taskData);
        break;
      } catch (enqueueErr) {
        if (attempts === config.maxEnqueueAttempts) {
          throw enqueueErr;
        }
      }
    }
  } catch (enqueueErr) {
    await events.recordErrorEvent(enqueueErr as Error);

    logs.logFailedEventAction(
      "Failed to enqueue event to Cloud Tasks from onWrite handler",
      taskData.fullResourceName,
      taskData.eventId,
      taskData.changeType,
      enqueueErr as Error
    );
  }
}

/**
 * Sets up BigQuery synchronization by initializing the event tracker
 */
export const setupBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    const runtime = getExtensions().runtime();
    await eventTracker.initialize();
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
  });

/**
 * Initializes BigQuery synchronization
 */
export const initBigQuerySync = functions.tasks
  .taskQueue()
  .onDispatch(async () => {
    const runtime = getExtensions().runtime();
    await eventTracker.initialize();
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Sync setup completed"
    );
    return;
  });

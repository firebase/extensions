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

import {
  ChangeType,
  type FirestoreBigQueryEventHistoryTracker,
  type FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import type {
  Change,
  DocumentSnapshot,
  FirestoreEvent,
} from "firebase-functions/firestore";
import type { Request } from "firebase-functions/tasks";
import * as events from "./events";
import type { ResolvedExportConfig } from "./export-config";
import * as logs from "./logs";
import { getChangeType, getDocumentId } from "./util";

/**
 * Serialized Firestore change ready to write to BigQuery. Also the
 * `syncBigQuery` task payload: it is built from already-serialized data, so it
 * survives the JSON round trip through Cloud Tasks unchanged.
 */
export interface SerializedDocumentChange {
  timestamp: string;
  eventId: string;
  fullResourceName: string;
  changeType: ChangeType;
  documentId: string;
  params: FirestoreDocumentChangeEvent["pathParams"] | null;
  data: FirestoreDocumentChangeEvent["data"];
  oldData: FirestoreDocumentChangeEvent["oldData"];
}

/** The Firestore document-write event passed to {@link handleDocumentWrite}. */
export type DocumentWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

/**
 * Everything a handler needs to do its work, injected by the caller so the
 * handlers stay free of global state.
 */
export interface HandlerContext {
  tracker: FirestoreBigQueryEventHistoryTracker;
  config: ResolvedExportConfig;
  /**
   * Provisions the BigQuery dataset/table/views once per instance. Called by
   * the `syncBigQuery` task as a self-heal before re-attempting a write; the
   * hot path relies on out-of-band provisioning
   * (`initBigQuerySync` / `setupBigQuerySync`).
   */
  ensureInitialized: () => Promise<void>;
  /**
   * Enqueues a failed change onto the `syncBigQuery` task queue. Rejects with
   * the enqueue error once its own retry budget is exhausted.
   */
  enqueue: (change: SerializedDocumentChange) => Promise<void>;
}

/**
 * Records a Firestore document change to BigQuery.
 *
 * @param change - Serialized change metadata and payload.
 * @param tracker - The event history tracker to write through.
 */
async function recordEventToBigQuery(
  change: SerializedDocumentChange,
  tracker: FirestoreBigQueryEventHistoryTracker
): Promise<void> {
  const event: FirestoreDocumentChangeEvent = {
    timestamp: change.timestamp,
    operation: change.changeType,
    documentName: change.fullResourceName,
    documentId: change.documentId,
    pathParams: change.params,
    eventId: change.eventId,
    data: change.data,
    oldData: change.oldData,
  };

  await tracker.record([event]);
}

/**
 * Buffers a failed inline write through the `syncBigQuery` task queue. A
 * terminal enqueue failure is logged, recorded, and rethrown so the trigger
 * retry policy covers the window where both BigQuery and Cloud Tasks fail;
 * swallowing it here would drop the event with no durable copy.
 *
 * @param change - The serialized change to enqueue.
 * @param ctx - The handler context.
 */
async function enqueueForSync(
  change: SerializedDocumentChange,
  ctx: HandlerContext
): Promise<void> {
  try {
    await ctx.enqueue(change);
  } catch (enqueueErr) {
    await events.recordErrorEvent(enqueueErr as Error);

    logs.logFailedEventAction(
      "Failed to enqueue event to Cloud Tasks from onWrite handler",
      change.fullResourceName,
      change.eventId,
      change.changeType,
      enqueueErr as Error
    );

    throw enqueueErr;
  }
}

/**
 * Handles a Firestore document write: serializes the change and writes it to
 * BigQuery. A failed inline write is buffered through the `syncBigQuery` task
 * queue; only a failed enqueue surfaces to the trigger retry policy.
 *
 * @param event - The Firestore document-write event.
 * @param ctx - The handler context.
 */
export async function handleDocumentWrite(
  event: DocumentWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  const { data, ...context } = event;
  if (!data) return;

  logs.start();

  // No provisioning on the hot path: BigQuery resources are provisioned
  // out-of-band (afterFirstDeploy / afterRedeploy tasks). If they are missing,
  // the inline write fails and the change buffers through the syncBigQuery
  // queue, whose handler self-heals before re-attempting.
  const { config, tracker } = ctx;
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

  let serializedData: FirestoreDocumentChangeEvent["data"];
  let serializedOldData: FirestoreDocumentChangeEvent["oldData"];

  try {
    serializedData = tracker.serializeData(newData);
    serializedOldData = tracker.serializeData(oldData);
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

  const change: SerializedDocumentChange = {
    timestamp: context.time,
    eventId: context.id,
    fullResourceName,
    changeType,
    documentId,
    params: config.wildcardIds ? { ...context.params, documentId } : null,
    data: serializedData,
    oldData: serializedOldData,
  };

  try {
    await recordEventToBigQuery(change, tracker);
  } catch (err) {
    logs.failedToWriteToBigQueryImmediately(err as Error);
    await enqueueForSync(change, ctx);
  }

  logs.complete();
}

/**
 * Handles a `syncBigQuery` task: re-attempts a buffered write. Provisioning
 * runs first as a self-heal (memoized, a no-op after the first success), so a
 * write that failed only because the BigQuery resources were missing succeeds
 * on the first task attempt. A failed write rethrows so Cloud Tasks retries
 * on the queue's schedule; the tracker has already written the row to the
 * backup collection (when one is configured) before each terminal rethrow.
 *
 * @param req - The dispatched task request carrying the serialized change.
 * @param ctx - The handler context.
 */
export async function handleSyncBigQueryTask(
  req: Request<SerializedDocumentChange>,
  ctx: HandlerContext
): Promise<void> {
  const change = req.data;

  logs.logEventAction(
    "Firestore event received by onDispatch trigger",
    change.fullResourceName,
    change.eventId,
    change.changeType
  );

  try {
    await ctx.ensureInitialized();
    await recordEventToBigQuery(change, ctx.tracker);

    await events.recordSuccessEvent({
      subject: change.documentId,
      data: {
        timestamp: change.timestamp,
        operation: change.changeType,
        documentName: change.fullResourceName,
        documentId: change.documentId,
        pathParams: change.params,
        eventId: change.eventId,
        data: change.data,
        oldData: change.oldData,
      },
    });

    logs.complete();
  } catch (err) {
    logs.logFailedEventAction(
      "Failed to write event to BigQuery from onDispatch handler",
      change.fullResourceName,
      change.eventId,
      change.changeType,
      err as Error,
      req.retryCount
    );

    throw err;
  }
}

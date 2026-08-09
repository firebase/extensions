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
import * as events from "./events";
import type { ResolvedExportConfig } from "./export-config";
import * as logs from "./logs";
import { getChangeType, getDocumentId } from "./util";

/** Serialized Firestore change ready to write to BigQuery. */
interface SerializedDocumentChange {
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
   * Provisions the BigQuery dataset/table/views once per instance. Only called
   * after an inline write failure as a self-heal; the hot path relies on
   * out-of-band provisioning (`initBigQuerySync` / `setupBigQuerySync`).
   */
  ensureInitialized: () => Promise<void>;
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
 * Gives a failed inline write one self-heal attempt before surfacing it to the
 * Firestore trigger retry policy.
 *
 * @param change - The serialized change to write.
 * @param ctx - The handler context.
 */
async function retryAfterSelfHeal(
  change: SerializedDocumentChange,
  ctx: HandlerContext
): Promise<void> {
  try {
    await ctx.ensureInitialized();
    await recordEventToBigQuery(change, ctx.tracker);
  } catch (retryErr) {
    await events.recordErrorEvent(retryErr as Error);

    logs.logFailedEventAction(
      "Failed to write event to BigQuery from onWrite handler after self-heal",
      change.fullResourceName,
      change.eventId,
      change.changeType,
      retryErr as Error
    );

    throw retryErr;
  }
}

/**
 * Handles a Firestore document write: serializes the change and writes it to
 * BigQuery. Failed writes are surfaced to the trigger retry policy after one
 * self-heal attempt.
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
  // the inline write fails, self-heals once, then falls back to the trigger
  // retry policy.
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
    await retryAfterSelfHeal(change, ctx);
  }

  logs.complete();
}

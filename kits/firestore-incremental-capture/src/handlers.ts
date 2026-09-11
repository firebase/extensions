/*
 * Copyright 2026 Google LLC
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

import type {
  Change,
  DocumentSnapshot,
  FirestoreEvent,
} from "firebase-functions/firestore";
import type { ResolvedCaptureConfig } from "./capture-config";
import type { ChangelogRow, ChangeType } from "./changelog";
import * as logs from "./logs";
import { serializeDocument } from "./serializer";

/** The Firestore document-write event passed to {@link handleDocumentWrite}. */
export type DocumentWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

/** A request to restore the backup database to a point in time. */
export interface RestorationRequest {
  /** Point to restore to, in whole seconds since the Unix epoch. */
  timestamp: number;
}

/** A launched Dataflow restoration job. */
export interface RestorationJob {
  /** Identifies the run in logs and in the Firestore status document. */
  runId: string;
  /** Dataflow's name for the job, absent if it did not report one. */
  jobName?: string;
}

/**
 * Everything the handlers need to do their work, injected by the caller so the
 * handlers stay free of global state and remain testable without emulators.
 */
export interface HandlerContext {
  config: ResolvedCaptureConfig;
  /** Enqueues a changelog row for asynchronous insertion into BigQuery. */
  enqueueChangelogRow(row: ChangelogRow): Promise<void>;
  /** Inserts changelog rows into the BigQuery changelog table. */
  insertChangelogRows(rows: ChangelogRow[]): Promise<void>;
  /** Enqueues a restoration, to be run outside the request's lifetime. */
  enqueueRestoration(request: RestorationRequest): Promise<void>;
  /** Launches the Dataflow restoration job. */
  launchRestorationJob(request: RestorationRequest): Promise<RestorationJob>;
}

/**
 * Classifies a document write.
 *
 * @param change - The before/after snapshots from the trigger.
 * @returns The change type.
 */
export function getChangeType(change: Change<DocumentSnapshot>): ChangeType {
  if (!change.before?.exists) return "CREATE";
  if (!change.after?.exists) return "DELETE";
  return "UPDATE";
}

/**
 * Checks that a value is a point in time the pipeline can restore to: a whole
 * number of seconds since the Unix epoch, not in the future.
 *
 * Restoration reads a Firestore PITR snapshot, so a timestamp older than the
 * PITR window is clamped by the pipeline rather than rejected here - the window
 * is a property of the database, not of the request.
 *
 * @param timestamp - The candidate timestamp.
 * @returns Whether the timestamp can be restored to.
 */
export function isValidRestorationTimestamp(
  timestamp: unknown
): timestamp is number {
  if (typeof timestamp !== "number" || !Number.isInteger(timestamp)) {
    return false;
  }

  if (timestamp <= 0) return false;

  return timestamp <= Math.floor(Date.now() / 1000);
}

/**
 * Captures a Firestore document write onto the changelog queue.
 *
 * The write is serialized here and inserted into BigQuery by
 * {@link handleChangelogTask}, so that a BigQuery outage retries on the task
 * queue's schedule rather than holding the Firestore trigger open.
 *
 * @param event - The Firestore document-write event.
 * @param ctx - The handler context.
 */
export async function handleDocumentWrite(
  event: DocumentWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  const change = event.data;
  if (!change) return;

  const changeType = getChangeType(change);
  const documentId = change.after?.id ?? change.before.id;
  const documentPath = change.after?.ref?.path ?? change.before.ref.path;

  logs.debug("Capturing Firestore write", {
    documentPath,
    changeType,
  });

  const row: ChangelogRow = {
    documentId,
    documentPath,
    beforeData: JSON.stringify(serializeDocument(change.before?.data())),
    afterData: JSON.stringify(serializeDocument(change.after?.data())),
    changeType,
    timestamp: event.time,
  };

  await ctx.enqueueChangelogRow(row);
}

/**
 * Inserts one queued changelog row into BigQuery.
 *
 * @param row - The row enqueued by {@link handleDocumentWrite}.
 * @param ctx - The handler context.
 * @throws If the insert fails, so the task queue retries it. A dropped row is a
 *   permanent hole in the changelog, and therefore in any restoration that
 *   replays across it.
 */
export async function handleChangelogTask(
  row: ChangelogRow,
  ctx: HandlerContext
): Promise<void> {
  await ctx.insertChangelogRows([row]);

  logs.debug("Wrote changelog row", { documentPath: row.documentPath });
}

/** Outcome of {@link handleRestorationRequest}, for the caller to send. */
export interface RestorationResponse {
  status: number;
  body: string;
}

/**
 * Validates an inbound restoration request and enqueues the work.
 *
 * @param body - The parsed request body.
 * @param ctx - The handler context.
 * @returns The status and body to respond with.
 */
export async function handleRestorationRequest(
  body: unknown,
  ctx: HandlerContext
): Promise<RestorationResponse> {
  const timestamp = (body as { timestamp?: unknown } | null)?.timestamp;

  if (!isValidRestorationTimestamp(timestamp)) {
    logs.error(
      "Rejected restoration request: 'timestamp' must be a whole number of " +
        "seconds since the Unix epoch, and cannot be in the future.",
      { timestamp }
    );
    return {
      status: 400,
      body: "'timestamp' must be a past Unix timestamp in seconds.",
    };
  }

  await ctx.enqueueRestoration({ timestamp });

  logs.info("Enqueued restoration", { timestamp });

  return { status: 200, body: "Restoration task enqueued" };
}

/**
 * Runs a queued restoration by launching the Dataflow job.
 *
 * @param request - The restoration request enqueued by
 *   {@link handleRestorationRequest}.
 * @param ctx - The handler context.
 * @returns The launched job, or `undefined` if the request was not restorable.
 */
export async function handleRestorationTask(
  request: RestorationRequest,
  ctx: HandlerContext
): Promise<RestorationJob | undefined> {
  if (!isValidRestorationTimestamp(request?.timestamp)) {
    logs.error("Discarding restoration task with an invalid timestamp", {
      timestamp: request?.timestamp,
    });
    return undefined;
  }

  logs.info("Restoring to point in time", { timestamp: request.timestamp });

  const job = await ctx.launchRestorationJob(request);

  logs.info("Launched restoration job", job);

  return job;
}

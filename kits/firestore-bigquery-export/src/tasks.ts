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

import { getFunctions } from "firebase-admin/functions";
import type { SerializedDocumentChange } from "./handlers";
import { firestoreLocationToFunctionRegion } from "./region";

/** Export name of the write-buffer task function. */
export const SYNC_BIGQUERY_FUNCTION = "syncBigQuery";

const MAX_BACKOFF_MS = 5000;
const BACKOFF_BASE_MS = 100;
const JITTER_MS = 100;

/** Cloud Tasks accepts `[A-Za-z0-9_-]{1,500}` as a task id. */
const TASK_ID_DISALLOWED = /[^A-Za-z0-9_-]/g;

function taskIdFor(change: SerializedDocumentChange): string {
  return change.eventId.replace(TASK_ID_DISALLOWED, "-").slice(0, 500);
}

/**
 * Resolves the queue resource path for a task function of this kit instance.
 *
 * The name is deliberately unprefixed: firebase-admin >= 14.2.0 resolves the
 * deployed `kit-<instance id>-` prefix itself from the
 * `FIREBASE_KIT_INSTANCE_ID` env var, which the CLI sets on every deployed kit
 * function. All functions of a kit instance deploy to one region, so the
 * enqueuing function's own region is the queue's region.
 *
 * The CLI-set `FUNCTION_REGION` wins because it is the region the function
 * was actually deployed to; a `DATABASE_REGION`-derived region can disagree
 * with it on a first deploy or when the variable is unset, and is only the
 * fallback for local runs where the CLI has not populated the environment.
 *
 * @param functionName - The export name of the task function.
 * @returns The queue resource path, `locations/<region>/functions/<name>`.
 * @throws If no region can be resolved.
 */
export function syncQueuePath(
  functionName: string = SYNC_BIGQUERY_FUNCTION
): string {
  const region =
    process.env.FUNCTION_REGION ||
    firestoreLocationToFunctionRegion(process.env.DATABASE_REGION);

  if (!region) {
    throw new Error(
      "A region is required to resolve the syncBigQuery task queue. " +
        "Deploy with the Firebase CLI (which sets FUNCTION_REGION) or set DATABASE_REGION."
    );
  }

  return `locations/${region}/functions/${functionName}`;
}

function backoffMs(attempt: number, jitter: number): number {
  return (
    Math.min(Math.pow(2, attempt) * BACKOFF_BASE_MS, MAX_BACKOFF_MS) + jitter
  );
}

/**
 * Enqueues a payload onto the `syncBigQuery` queue, retrying transient enqueue
 * failures in-process with exponential backoff and jitter.
 *
 * The task id is derived from the event id, so a retried enqueue of an event
 * that already reached Cloud Tasks is rejected rather than buffered twice.
 *
 * @param payload - The serialized change to enqueue.
 * @param maxAttempts - How many enqueue attempts to make before giving up.
 *   Clamped to at least 1: resolving without an enqueue would report success
 *   for an event that was never buffered anywhere.
 * @throws The last enqueue error, once every attempt has failed.
 */
export async function enqueueSyncTask(
  payload: SerializedDocumentChange,
  maxAttempts: number
): Promise<void> {
  const queue = getFunctions().taskQueue(syncQueuePath());
  const id = taskIdFor(payload);

  // Math.max(1, NaN) is NaN and would skip the loop entirely.
  const attemptBudget =
    Number.isInteger(maxAttempts) && maxAttempts >= 1 ? maxAttempts : 1;
  const jitter = Math.random() * JITTER_MS;
  let attempts = 0;

  while (attempts < attemptBudget) {
    if (attempts > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, backoffMs(attempts, jitter))
      );
    }

    attempts++;
    try {
      await queue.enqueue(payload, { id });
      return;
    } catch (enqueueErr) {
      // The event is already buffered; a second task would double-write the row.
      // firebase-admin prefixes its codes: `functions/task-already-exists`.
      if (
        (enqueueErr as { code?: string })?.code ===
        "functions/task-already-exists"
      ) {
        return;
      }

      if (attempts >= attemptBudget) {
        throw enqueueErr;
      }
    }
  }
}

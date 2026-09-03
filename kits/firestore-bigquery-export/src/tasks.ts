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
import { firestoreLocationToFunctionRegion } from "./region";

/** Export name of the write-buffer task function. */
export const SYNC_BIGQUERY_FUNCTION = "syncBigQuery";

const MAX_BACKOFF_MS = 5000;
const BACKOFF_BASE_MS = 100;
const JITTER_MS = 100;

/**
 * Resolves the queue resource path for a task function of this kit instance.
 *
 * The name is deliberately unprefixed: firebase-admin >= 14.2.0 resolves the
 * deployed `kit-<instance id>-` prefix itself from the
 * `FIREBASE_KIT_INSTANCE_ID` env var, which the CLI sets on every deployed kit
 * function. All functions of a kit instance deploy to one region, so the
 * enqueuing function's own region (`DATABASE_REGION`-derived, with the
 * CLI-set `FUNCTION_REGION` as fallback) is also the queue's region.
 *
 * @param functionName - The export name of the task function.
 * @returns The queue resource path, `locations/<region>/functions/<name>`.
 * @throws If no region can be resolved.
 */
export function syncQueuePath(
  functionName: string = SYNC_BIGQUERY_FUNCTION
): string {
  const region =
    firestoreLocationToFunctionRegion(process.env.DATABASE_REGION) ??
    process.env.FUNCTION_REGION;

  if (!region) {
    throw new Error(
      "A region is required to resolve the syncBigQuery task queue. " +
        "Set DATABASE_REGION, or deploy with the Firebase CLI so FUNCTION_REGION is set."
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
 * @param payload - The task payload.
 * @param maxAttempts - How many enqueue attempts to make before giving up.
 *   Clamped to at least 1: resolving without an enqueue would report success
 *   for an event that was never buffered anywhere.
 * @throws The last enqueue error, once every attempt has failed.
 */
export async function enqueueSyncTask(
  payload: object,
  maxAttempts: number
): Promise<void> {
  const queue = getFunctions().taskQueue(syncQueuePath());

  const attemptBudget = Math.max(1, maxAttempts);
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
      await queue.enqueue(payload);
      return;
    } catch (enqueueErr) {
      if (attempts >= attemptBudget) {
        throw enqueueErr;
      }
    }
  }
}

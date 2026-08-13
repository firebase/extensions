/**
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

import * as admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ChangeTrackerConfig } from ".";

if (!admin.apps.length) {
  initializeApp();
}

/**
 * Firestore instances whose `settings()` call has already been attempted.
 *
 * `getFirestore` returns one instance per database id, and `settings()` may only
 * be called once on it, before it is used. Calling it on every failed batch
 * therefore threw on every call after the first, so only the first failure in an
 * instance's lifetime was ever backed up.
 */
const settingsApplied = new Set<string>();

function backupFirestore(instanceId: string) {
  const db = getFirestore(instanceId);

  if (!settingsApplied.has(instanceId)) {
    settingsApplied.add(instanceId);

    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (settingsError) {
      // Something else in the process reached this instance first. The backup
      // still goes ahead, but an undefined value in a row will now throw from
      // `set()` instead of being skipped.
    }
  }

  return db;
}

/** Distinct messages recorded before the rest are counted instead. */
const MAX_ERROR_MESSAGES = 5;

/** Cap, so one bad insert cannot write an unbounded Firestore field. */
const MAX_ERROR_DETAILS_LENGTH = 1000;

function truncate(
  value: string,
  limit: number = MAX_ERROR_DETAILS_LENGTH
): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

/**
 * The per-field messages a `PartialFailureError` nests under
 * `errors[].errors[].message`, deduplicated and capped.
 *
 * One failure can name several rows, and each row several fields, but a whole
 * batch usually fails the same way, so the distinct messages are what an
 * operator needs. Returns `""` when there is nothing usable to report.
 */
function nestedErrorMessages(e: unknown): string {
  const groups = (e as any)?.errors;

  if (!Array.isArray(groups)) return "";

  const messages = new Set<string>();

  for (const group of groups) {
    const inner = (group as any)?.errors;
    const entries = Array.isArray(inner) ? inner : [group];

    for (const entry of entries) {
      const message = (entry as any)?.message;

      if (typeof message === "string" && message.length > 0) {
        messages.add(message);
        continue;
      }

      // A `stopped` entry, the row BigQuery did not attempt, carries an empty
      // `message` and an empty `location`, so `reason` is the only field that
      // identifies it. Without this a failure whose entries are all `stopped`
      // recorded nothing but the error's class name.
      const reason = (entry as any)?.reason;

      if (typeof reason === "string" && reason.length > 0) {
        messages.add(reason);
      }
    }
  }

  if (messages.size === 0) return "";

  const all = Array.from(messages);
  const shown = all.slice(0, MAX_ERROR_MESSAGES);
  const remaining = all.length - shown.length;
  const suffix = remaining > 0 ? ` (+${remaining} more)` : "";

  // Truncating the messages rather than the finished string, so the count is
  // not the part that gets cut off. The result still fits the cap.
  return `${truncate(
    shown.join("; "),
    MAX_ERROR_DETAILS_LENGTH - suffix.length
  )}${suffix}`;
}

/**
 * A description of a failed insert that an operator can act on.
 *
 * The caught value is not always an Error: `insertData` reports whatever it
 * caught. Reading `.message` off a non-object threw a TypeError from here,
 * which the caller then reported as a failed backup, so nothing was written
 * for exactly the malformed failures the backup is most needed for.
 *
 * Its message is also not always populated. The common failure is a
 * `PartialFailureError`, whose message `@google-cloud/common` builds from the
 * `message` of each entry in `errors`. Those entries are `{ errors, row }`
 * pairs and carry no `message` of their own, so the message it builds is the
 * empty string, and the reason for the failure ("no such field: document_id.")
 * is only reachable one level further down. `??` kept that empty string,
 * because it falls back on null and undefined but not on "".
 */
function describeError(e: unknown): string {
  // The whole body is guarded, not just `String(e)`, so that reading `.message`
  // off a value with a throwing getter cannot escape either.
  try {
    const message = (e as any)?.message;

    if (typeof message === "string" && message.length > 0) {
      return truncate(message);
    }

    // Already capped, so it is not truncated a second time here.
    const nested = nestedErrorMessages(e);

    if (nested.length > 0) return nested;

    return truncate(String(e));
  } catch (describeFailure) {
    // A value whose `toString` or `message` throws, or an object with a null
    // prototype.
    return "Unknown error";
  }
}

export default async (
  rows: any[],
  config: ChangeTrackerConfig,
  e: Error
): Promise<void> => {
  const db = backupFirestore(config.firestoreInstanceId!);

  const errorDetails = describeError(e);

  const batchArray = [db.batch()];

  let operationCounter = 0;
  let batchIndex = 0;

  rows?.forEach((row) => {
    var ref = db.collection(config.backupTableId).doc(row.insertId);

    batchArray[batchIndex].set(ref, {
      ...row,
      error_details: errorDetails,
    });

    operationCounter++;

    // Check if max limit for batch has been met.
    if (operationCounter === 499) {
      batchArray.push(db.batch());
      batchIndex++;
      operationCounter = 0;
    }
  });

  for (let batch of batchArray) {
    await batch.commit();
  }

  return Promise.resolve();
};

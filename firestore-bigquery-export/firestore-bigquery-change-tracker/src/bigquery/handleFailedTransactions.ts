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

function truncate(value: string): string {
  return value.length > MAX_ERROR_DETAILS_LENGTH
    ? `${value.slice(0, MAX_ERROR_DETAILS_LENGTH - 3)}...`
    : value;
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
      }
    }
  }

  if (messages.size === 0) return "";

  const all = Array.from(messages);
  const shown = all.slice(0, MAX_ERROR_MESSAGES);
  const remaining = all.length - shown.length;

  return remaining > 0
    ? `${shown.join("; ")} (+${remaining} more)`
    : shown.join("; ");
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
  const message = (e as any)?.message;

  if (typeof message === "string" && message.length > 0) {
    return truncate(message);
  }

  const nested = nestedErrorMessages(e);

  if (nested.length > 0) return truncate(nested);

  try {
    return truncate(String(e));
  } catch (stringifyError) {
    // A value whose `toString` throws, or an object with a null prototype.
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

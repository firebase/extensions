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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";

import config from "./config";
import * as logs from "./logs";
import * as validators from "./validators";
import * as events from "./events";
import {
  translateDocumentBackfill,
  translateDocument,
  extractLanguages,
  updateTranslations,
  extractInput,
} from "./translate";
enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

const DOCS_PER_BACKFILL = 250;
// Initialize the Firebase Admin SDK
admin.initializeApp();
events.setupEventChannel();

logs.init(config);

export const fstranslate = functions.firestore
  .document(process.env.COLLECTION_PATH)
  .onWrite(async (change, context): Promise<void> => {
    logs.start(config);
    await events.recordStartEvent({ change, context });
    const { languages, inputFieldName, outputFieldName } = config;

    if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
      logs.fieldNamesNotDifferent();
      await events.recordCompletionEvent({ context });
      return;
    }
    if (
      validators.fieldNameIsTranslationPath(
        inputFieldName,
        outputFieldName,
        languages
      )
    ) {
      logs.inputFieldNameIsOutputPath();
      await events.recordCompletionEvent({ context });
      return;
    }

    const changeType = getChangeType(change);

    try {
      switch (changeType) {
        case ChangeType.CREATE:
          await handleCreateDocument(change.after);
          break;
        case ChangeType.DELETE:
          handleDeleteDocument();
          break;
        case ChangeType.UPDATE:
          await handleUpdateDocument(change.before, change.after);
          break;
      }

      logs.complete();
    } catch (err) {
      logs.error(err);
      events.recordErrorEvent(err as Error);
    }
    await events.recordCompletionEvent({ context });
  });

export const fstranslatebackfill = functions.tasks
  .taskQueue()
  .onDispatch(async (data: any) => {
    const runtime = getExtensions().runtime();
    if (!config.doBackfill) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        'Existing documents were not translated because "Translate existing documents?" is configured to false. ' +
          "If you want to fill in missing translations, reconfigure this instance."
      );
      return;
    }
    const offset = (data["offset"] as number) ?? 0;
    const pastSuccessCount = (data["successCount"] as number) ?? 0;
    const pastErrorCount = (data["errorCount"] as number) ?? 0;
    // We also track the start time of the first invocation, so that we can report the full length at the end.
    const startTime = (data["startTime"] as number) ?? Date.now();

    const snapshot = await admin
      .firestore()
      .collection(process.env.COLLECTION_PATH)
      .offset(offset)
      .limit(DOCS_PER_BACKFILL)
      .get();
    // Since we will be writing many docs to Firestore, use a BulkWriter for better performance.
    const writer = admin.firestore().bulkWriter();
    const translations = await Promise.allSettled(
      snapshot.docs.map((doc) => {
        return handleExistingDocument(doc, writer);
      })
    );
    // Close the writer to commit the changes to Firestore.
    await writer.close();
    const newSucessCount =
      pastSuccessCount +
      translations.filter((p) => p.status === "fulfilled").length;
    const newErrorCount =
      pastErrorCount +
      translations.filter((p) => p.status === "rejected").length;

    if (snapshot.size == DOCS_PER_BACKFILL) {
      // Stil have more documents to translate, enqueue another task.
      logs.enqueueNext(offset + DOCS_PER_BACKFILL);
      const queue = getFunctions().taskQueue(
        `locations/${config.location}/functions/fstranslatebackfill`,
        process.env.EXT_INSTANCE_ID
      );
      await queue.enqueue({
        offset: offset + DOCS_PER_BACKFILL,
        successCount: newSucessCount,
        errorCount: newErrorCount,
        startTime: startTime,
      });
    } else {
      // No more documents to translate, time to set the processing state.
      logs.backfillComplete(newSucessCount, newErrorCount);
      if (newErrorCount == 0) {
        return await runtime.setProcessingState(
          "PROCESSING_COMPLETE",
          `Successfully translated ${newSucessCount} documents in ${
            Date.now() - startTime
          }ms.`
        );
      } else if (newErrorCount > 0 && newSucessCount > 0) {
        return await runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Successfully translated ${newSucessCount} documents, ${newErrorCount} errors in ${
            Date.now() - startTime
          }ms. See function logs for specific error messages.`
        );
      }
      return await runtime.setProcessingState(
        "PROCESSING_FAILED",
        `Successfully translated ${newSucessCount} documents, ${newErrorCount} errors in ${
          Date.now() - startTime
        }ms. See function logs for specific error messages.`
      );
    }
  });

const getChangeType = (
  change: functions.Change<admin.firestore.DocumentSnapshot>
): ChangeType => {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

const handleExistingDocument = async (
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const input = extractInput(snapshot);
  try {
    if (input) {
      return await translateDocumentBackfill(snapshot, bulkWriter);
    } else {
      logs.documentFoundNoInput();
    }
  } catch (err) {
    logs.translateInputToAllLanguagesError(input, err);
    await events.recordErrorEvent(err as Error);
    throw err;
  }
};

const handleCreateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const input = extractInput(snapshot);
  if (input) {
    logs.documentCreatedWithInput();
    await translateDocument(snapshot);
  } else {
    logs.documentCreatedNoInput();
  }
};

const handleDeleteDocument = (): void => {
  logs.documentDeleted();
};

const handleUpdateDocument = async (
  before: admin.firestore.DocumentSnapshot,
  after: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const inputBefore = extractInput(before);
  const inputAfter = extractInput(after);

  const languagesBefore = extractLanguages(before);
  const languagesAfter = extractLanguages(after);

  // If previous and updated documents have no input, skip.
  if (inputBefore === undefined && inputAfter === undefined) {
    logs.documentUpdatedNoInput();
    return;
  }

  // If updated document has no string or object input, delete any existing translations.
  if (typeof inputAfter !== "string" && typeof inputAfter !== "object") {
    await updateTranslations(after, admin.firestore.FieldValue.delete());
    logs.documentUpdatedDeletedInput();
    return;
  }

  if (
    JSON.stringify(inputBefore) === JSON.stringify(inputAfter) &&
    JSON.stringify(languagesBefore) === JSON.stringify(languagesAfter)
  ) {
    logs.documentUpdatedUnchangedInput();
  } else {
    logs.documentUpdatedChangedInput();
    await translateDocument(after);
  }
};

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
import { Translate } from "@google-cloud/translate";

import config from "./config";
import * as logs from "./logs";
import * as validators from "./validators";

type Translation = {
  language: string;
  output: string;
};

enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}
const DOCS_PER_BACKFILL = 200;
const translate = new Translate({ projectId: process.env.PROJECT_ID });

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init(config);

export const fstranslate = functions.firestore
  .document(process.env.COLLECTION_PATH)
  .onWrite(async (change): Promise<void> => {
    logs.start(config);
    const { languages, inputFieldName, outputFieldName } = config;

    if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
      logs.fieldNamesNotDifferent();
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
    }
  });

export const fstranslatebackfill = functions.tasks
  .taskQueue()
  .onDispatch(async (data: any) => {
    const runtime = getExtensions().runtime();
    if (!config.doBackfill) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        "Existing documents were not backfilled."
      );
      return;
    }
    const offset = (data["offset"] as number) ?? 0;
    const pastSuccessCount = (data["successCount"] as number) ?? 0;
    const pastErrorCount = (data["errorCount"] as number) ?? 0;

    const snapshot = await admin
      .firestore()
      .collection(process.env.COLLECTION_PATH)
      .offset(offset)
      .get();
    const translations = await Promise.allSettled(
      snapshot.docs.map(handleExistingDocument)
    );
    const newSucessCount =
      pastSuccessCount +
      translations.filter((p) => p.status === "fulfilled").length;
    const newErrorCount =
      pastErrorCount +
      translations.filter((p) => p.status === "rejected").length;

    if (snapshot.size == DOCS_PER_BACKFILL) {
      const queue = getFunctions().taskQueue(
        "fstranslatebackfill",
        process.env.EXT_INSTANCE_ID
      );
      await queue.enqueue({
        offset: offset + DOCS_PER_BACKFILL,
        successCount: newSucessCount,
        errorCount: newErrorCount,
      });
    } else {
      logs.backfillComplete(newSucessCount, newErrorCount);
      if (newErrorCount == 0) {
        runtime.setProcessingState(
          "PROCESSING_COMPLETE",
          `Successfully backfilled ${newSucessCount} documents.`
        );
      } else if (newErrorCount > 0 && newSucessCount > 0) {
        runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Successfully backfilled ${newSucessCount} documents, failed to translate ${newErrorCount} documents.`
        );
      }
      if (newErrorCount > 0 && newSucessCount == 0) {
        runtime.setProcessingState(
          "PROCESSING_FAILED",
          `Successfully backfilled ${newSucessCount} documents, failed to translate ${newErrorCount} documents.`
        );
      }
    }
  });

const extractInput = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.inputFieldName);
};

const extractOutput = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.outputFieldName);
};

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
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const input = extractInput(snapshot);
  if (input) {
    logs.documentFoundWithInput();
    await translateDocument(snapshot, /*keepExistingTranslations=*/ true);
  } else {
    logs.documentFoundNoInput();
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

  if (JSON.stringify(inputBefore) === JSON.stringify(inputAfter)) {
    logs.documentUpdatedUnchangedInput();
  } else {
    logs.documentUpdatedChangedInput();
    await translateDocument(after);
  }
};

const translateSingle = async (
  input: string,
  snapshot: admin.firestore.DocumentSnapshot,
  keepExistingTranslations: boolean = false
): Promise<void> => {
  const existingTranslations = extractOutput(snapshot);
  const languages = config.languages.filter(
    (targetLanguage: string): boolean => {
      if (
        !keepExistingTranslations ||
        existingTranslations[targetLanguage] != undefined
      ) {
        logs.skippingLanguage(targetLanguage);
        return false;
      }
      return true;
    }
  );
  logs.translateInputStringToAllLanguages(input, languages);

  const tasks = languages.map(
    async (targetLanguage: string): Promise<Translation> => {
      return {
        language: targetLanguage,
        output: await translateString(input, targetLanguage),
      };
    }
  );

  try {
    const translations = await Promise.all(tasks);

    logs.translateInputToAllLanguagesComplete(input);

    const translationsMap: { [language: string]: string } = translations.reduce(
      (output, translation) => {
        output[translation.language] = translation.output;
        return output;
      },
      {}
    );

    return updateTranslations(snapshot, translationsMap);
  } catch (err) {
    logs.translateInputToAllLanguagesError(input, err);
    throw err;
  }
};

const translateMultiple = async (
  input: object,
  snapshot: admin.firestore.DocumentSnapshot,
  keepExistingTranslations: boolean = false
): Promise<void> => {
  let translations = {};
  let promises = [];
  const existingTranslations = extractOutput(snapshot);

  Object.entries(input).forEach(([entry, value]) => {
    const languages = config.languages.filter(
      (targetLanguage: string): boolean =>
        !keepExistingTranslations ||
        existingTranslations[entry][targetLanguage] != undefined
    );
    languages.forEach((language) => {
      promises.push(
        () =>
          new Promise<void>(async (resolve) => {
            logs.translateInputStringToAllLanguages(value, languages);

            const output =
              typeof value === "string"
                ? await translateString(value, language)
                : null;

            if (!translations[entry]) translations[entry] = {};
            translations[entry][language] = output;

            return resolve();
          })
      );
    });
  });

  for (const fn of promises) {
    if (fn) await fn();
  }

  return updateTranslations(snapshot, translations);
};

const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot,
  keepExistingTranslations: boolean = false
): Promise<void> => {
  const input: any = extractInput(snapshot);

  if (typeof input === "object") {
    return translateMultiple(input, snapshot, keepExistingTranslations);
  }

  await translateSingle(input, snapshot, keepExistingTranslations);
};

const translateString = async (
  string: string,
  targetLanguage: string
): Promise<string> => {
  try {
    logs.translateInputString(string, targetLanguage);

    const [translatedString] = await translate.translate(
      string,
      targetLanguage
    );

    logs.translateStringComplete(string, targetLanguage);

    return translatedString;
  } catch (err) {
    logs.translateStringError(string, targetLanguage, err);
    throw err;
  }
};

const updateTranslations = async (
  snapshot: admin.firestore.DocumentSnapshot,
  translations: any
): Promise<void> => {
  logs.updateDocument(snapshot.ref.path);

  // Wrapping in transaction to allow for automatic retries (#48)
  await admin.firestore().runTransaction((transaction) => {
    transaction.update(snapshot.ref, config.outputFieldName, translations);
    return Promise.resolve();
  });

  logs.updateDocumentComplete(snapshot.ref.path);
};

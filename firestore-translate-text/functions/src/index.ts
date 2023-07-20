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
const DOCS_PER_BACKFILL = 250;
const translate = new Translate({ projectId: process.env.PROJECT_ID });

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init(config);

export const fstranslate = functions.firestore
  .document(process.env.COLLECTION_PATH)
  .onWrite(async (change): Promise<void> => {
    logs.start(config);
    const { inputFieldName, outputFieldName } = config;

    if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
      logs.fieldNamesNotDifferent();
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

const extractInput = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.inputFieldName);
};

const extractOutput = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.outputFieldName);
};

const extractLanguages = (
  snapshot: admin.firestore.DocumentSnapshot
): string[] => {
  if (!config.languagesFieldName) return config.languages;
  return snapshot.get(config.languagesFieldName) || config.languages;
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

const filterLanguagesFn = (
  existingTranslations: Record<string, any>
): ((string) => boolean) => {
  return (targetLanguage: string) => {
    if (existingTranslations[targetLanguage] != undefined) {
      logs.skippingLanguage(targetLanguage);
      return false;
    }
    return true;
  };
};

const translateSingle = async (
  input: string,
  languages: string[],
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
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

const translateSingleBackfill = async (
  input: string,
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const existingTranslations = extractOutput(snapshot) || {};
  // During backfills, we filter out languages that we already have translations for.
  const languages = config.languages.filter(
    filterLanguagesFn(existingTranslations)
  );

  const tasks = languages.map(
    async (targetLanguage: string): Promise<Translation> => {
      return {
        language: targetLanguage,
        output: await translateString(input, targetLanguage),
      };
    }
  );

  const translations = await Promise.allSettled(tasks);
  const successfulTranslations = translations
    .filter((p) => p.status === "fulfilled")
    .map((p: PromiseFulfilledResult<Translation>) => p.value);
  const failedTranslations = translations
    .filter((p) => p.status === "rejected")
    .map((p: PromiseRejectedResult) => p.reason);

  const translationsMap: { [language: string]: string } =
    successfulTranslations.reduce((output, translation) => {
      output[translation.language] = translation.output;
      return output;
    }, existingTranslations);

  // Use firestore.BulkWriter for better performance when writing many docs to Firestore.
  bulkWriter.update(snapshot.ref, config.outputFieldName, translationsMap);

  if (failedTranslations.length && !successfulTranslations.length) {
    logs.translateInputToAllLanguagesError(
      input,
      new Error(failedTranslations.join("\n"))
    );
  } else if (failedTranslations.length && successfulTranslations.length) {
    logs.partialTranslateError(input, failedTranslations, translations.length);
    // If any translations failed, throw so it is reported as an error.
    throw `Error while translating '${input}': ${
      failedTranslations.length
    } out of ${languages.length} translations failed: ${failedTranslations.join(
      "\n"
    )}`;
  } else {
    logs.translateInputToAllLanguagesComplete(input);
  }
};

const translateMultiple = async (
  input: object,
  languages: string[],
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  let translations = {};
  let promises = [];

  Object.entries(input).forEach(([input, value]) => {
    languages.forEach((language) => {
      promises.push(
        () =>
          new Promise<void>(async (resolve) => {
            logs.translateInputStringToAllLanguages(value, languages);

            const output =
              typeof value === "string"
                ? await translateString(value, language)
                : null;

            if (!translations[input]) translations[input] = {};
            translations[input][language] = output;

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

const translateMultipleBackfill = async (
  input: object,
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const existingTranslations = extractOutput(snapshot);
  let translations = existingTranslations;
  let promises: Promise<void>[] = [];

  for (let [entry, value] of Object.entries(input)) {
    // If keeping original translations, filter out languages we already have translated.
    const languages = config.languages.filter(
      filterLanguagesFn(existingTranslations[entry] ?? {})
    );

    for (const language of languages) {
      promises.push(
        new Promise<void>(async (resolve) => {
          const output =
            typeof value === "string"
              ? await translateString(value, language)
              : null;

          if (!translations[entry]) translations[entry] = {};
          translations[entry][language] = output;

          return resolve();
        })
      );
    }
  }

  const results = await Promise.allSettled(promises);
  const successfulTranslations = results.filter(
    (p) => p.status === "fulfilled"
  );
  const failedTranslations = results
    .filter((p) => p.status === "rejected")
    .map((p: PromiseRejectedResult) => p.reason);

  // Use firestore.BulkWriter for better performance when writing many docs to Firestore.
  bulkWriter.update(snapshot.ref, config.outputFieldName, translations);

  if (failedTranslations.length && !successfulTranslations.length) {
    logs.partialTranslateError(
      JSON.stringify(input),
      failedTranslations,
      translations.length
    );
    // If any translations failed, throw so it is reported as an error.
    throw `${
      failedTranslations.length
    } error(s) while translating '${input}': ${failedTranslations.join("\n")}`;
  } else {
    logs.translateInputToAllLanguagesComplete(JSON.stringify(input));
  }
};

const translateDocumentBackfill = async (
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const input: any = extractInput(snapshot);

  if (typeof input === "object") {
    return translateMultipleBackfill(input, snapshot, bulkWriter);
  }

  await translateSingleBackfill(input, snapshot, bulkWriter);
};

const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const input: any = extractInput(snapshot);
  const languages = extractLanguages(snapshot);

  if (
    validators.fieldNameIsTranslationPath(
      config.inputFieldName,
      config.outputFieldName,
      languages
    )
  ) {
    logs.inputFieldNameIsOutputPath();
    return;
  }

  if (typeof input === "object") {
    return translateMultiple(input, languages, snapshot);
  }

  await translateSingle(input, languages, snapshot);
};

const translateString = async (
  string: string,
  targetLanguage: string
): Promise<string> => {
  try {
    const [translatedString] = await translate.translate(
      string,
      targetLanguage
    );
    logs.translateStringComplete(string, targetLanguage, translatedString);
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

import * as logs from "../logs";
import * as events from "../events";
import * as admin from "firebase-admin";
import config from "../config";
import {
  extractOutput,
  filterLanguagesFn,
  translateString,
  Translation,
  updateTranslations,
} from "./common";

export const translateSingle = async (
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
    await events.recordErrorEvent(err as Error);
    throw err;
  }
};

export const translateSingleBackfill = async (
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

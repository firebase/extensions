import * as logs from "../logs";
import * as admin from "firebase-admin";
import config from "../config";
import {
  extractOutput,
  filterLanguagesFn,
  translateString,
  updateTranslations,
} from "./common";

export const translateMultiple = async (
  input: object,
  languages: string[],
  snapshot: admin.firestore.DocumentSnapshot,
  glossaryId?: string
): Promise<void> => {
  let translations = {};
  let promises = [];

  Object.entries(input).forEach(([input, value]) => {
    languages.forEach((language) => {
      promises.push(
        () =>
          new Promise<void>(async (resolve) => {
            logs.translateInputStringToAllLanguages(
              value,
              languages,
              glossaryId
            );

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

export const translateMultipleBackfill = async (
  input: object,
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const existingTranslations = extractOutput(snapshot) ?? {};

  let translations = existingTranslations;
  let promises: Promise<void>[] = [];

  for (let [entry, value] of Object.entries(input)) {
    // If keeping original translations, filter out languages we already have translated.
    const languages = config.languages.filter(
      filterLanguagesFn(existingTranslations[entry] ?? {})
    );

    for (const language of languages) {
      promises.push(
        new Promise<void>(async (resolve, reject) => {
          try {
            logs.info(
              `Translating input: ${JSON.stringify(input)} with glossary: ${
                config.glossaryId
              }`
            );
            const output =
              typeof value === "string"
                ? await translateString(value, language, config.glossaryId)
                : null;

            if (!translations[entry]) translations[entry] = {};
            translations[entry][language] = output;

            resolve();
          } catch (err) {
            logs.error(
              new Error(
                `Error translating entry '${entry}' to language '${language}': ${err.message}`
              )
            );
            reject(err); // Propagate the error
          }
        })
      );
    }
  }

  const results = await Promise.allSettled(promises);

  // Process successful translations
  const successfulTranslations = results.filter(
    (p) => p.status === "fulfilled"
  );

  // Process failed translations
  const failedTranslations = results
    .filter((p) => p.status === "rejected")
    .map((p: PromiseRejectedResult) => p.reason);

  // Use firestore.BulkWriter for better performance when writing many docs to Firestore.
  bulkWriter.update(snapshot.ref, config.outputFieldName, translations);

  // Log and handle failures
  if (failedTranslations.length) {
    logs.partialTranslateError(
      JSON.stringify(input),
      failedTranslations,
      translations.length
    );

    // Only throw an error if all translations failed
    if (!successfulTranslations.length) {
      throw new Error(
        `${
          failedTranslations.length
        } error(s) while translating '${JSON.stringify(
          input
        )}': ${failedTranslations.join("\n")}`
      );
    }
  }

  // Log successful completion
  logs.translateInputToAllLanguagesComplete(JSON.stringify(input));
};

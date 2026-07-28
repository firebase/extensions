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

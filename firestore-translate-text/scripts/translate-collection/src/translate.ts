import { TranslationServiceClient } from "@google-cloud/translate";
import admin from "firebase-admin";

const translationClient = new TranslationServiceClient();
translationClient.batchTranslateText({
  parent: "projects/dev-extensions-testing",
  sourceLanguageCode: "en",
});

const writeOutput = (
  snapshot: admin.firestore.DocumentSnapshot,
  outputFieldName: string,
  output: any
) => {
  return snapshot.ref.update(outputFieldName, output);
};

const translateContents = async (
  contents: string | string[],
  targetLanguage: string
) => {
  const [response] = await translationClient.translateText({
    parent: `projects/dev-extensions-testing`,
    contents: Array.isArray(contents) ? contents : [contents],
    targetLanguageCode: targetLanguage,
  });
  return response.translations;
};

const translateMultiple = async (
  snapshot: admin.firestore.DocumentSnapshot,
  input: object,
  targetLanguages: string[],
  outputFieldName: string
) => {};

const translateSingle = async (
  snapshot: admin.firestore.DocumentSnapshot,
  input: string,
  targetLanguages: string[],
  outputFieldName: string
) => {
  const requests = targetLanguages.map(async (targetLanguage: string) => {
    return {
      language: targetLanguage,
      output: await translateContents(input, targetLanguage),
    };
  });
  const response = await Promise.all(requests);

  const translationsMap: { [language: string]: string } = response.reduce(
    (output, translation) => {
      if (!translation.output) return output;
      output[translation.language] =
        translation.output[0].translatedText || undefined;
      return output;
    },
    {} as any
  );

  return writeOutput(snapshot, outputFieldName, translationsMap);
};

const extractField = (
  snapshot: admin.firestore.DocumentSnapshot,
  fieldName: string
) => {
  return snapshot.get(fieldName);
};

export const translateDocument = (
  snapshot: admin.firestore.DocumentSnapshot,
  languages: string[],
  inputFieldName: string,
  outputFieldName: string,
  languagesFieldName?: string
) => {
  const input = extractField(snapshot, inputFieldName);
  const targetLanguages = languagesFieldName
    ? extractField(snapshot, languagesFieldName)
    : languages;

  if (!input || targetLanguages.length === 0) return;

  if (typeof input === "object") {
    return translateMultiple(snapshot, input, targetLanguages, outputFieldName);
  }

  return translateSingle(snapshot, input, targetLanguages, outputFieldName);
};

import { TranslationServiceClient } from "@google-cloud/translate";
import admin from "firebase-admin";

const translationClient = new TranslationServiceClient();

const translate = async (
  gcProjectId: string,
  contents: string | string[],
  targetLanguage: string
) => {
  const [response] = await translationClient.translateText({
    parent: `projects/${gcProjectId}`,
    contents: Array.isArray(contents) ? contents : [contents],
    targetLanguageCode: targetLanguage,
  });
  return response.translations;
};

const translateMultiple = async (
  gcProjectId: string,
  input: object,
  targetLanguages: string[]
) => {
  const entries = Object.entries(input);

  const requests = targetLanguages.map(async (targetLanguage) => ({
    language: targetLanguage,
    output: await translate(
      gcProjectId,
      entries.map((entry) => entry[1]),
      targetLanguage
    ),
  }));

  const responses = await Promise.all(requests);

  return entries.reduce(
    (output, entry, index) => {
      output[entry[0]] = responses.reduce(
        (output, translation) => {
          if (!translation.output) return output;
          output[translation.language] =
            translation.output[index].translatedText;
          return output;
        },
        {} as any
      );
      return output;
    },
    {} as any
  );
};

const translateSingle = async (
  gcProjectId: string,
  input: string,
  targetLanguages: string[]
) => {
  const requests = targetLanguages.map(async (targetLanguage: string) => {
    return {
      language: targetLanguage,
      output: await translate(gcProjectId, input, targetLanguage),
    };
  });
  const response = await Promise.all(requests);

  return response.reduce(
    (output, translation) => {
      if (!translation.output) return output;
      output[translation.language] =
        translation.output[0].translatedText || undefined;
      return output;
    },
    {} as any
  );
};

export const translateDocument = async (
  gcProjectId: string,
  snapshot: admin.firestore.DocumentSnapshot,
  languages: string[],
  inputFieldName: string,
  outputFieldName: string,
  languagesFieldName?: string
) => {
  const input = snapshot.get(inputFieldName);
  const targetLanguages = languagesFieldName
    ? snapshot.get(languagesFieldName) || languages
    : languages;

  if (!input || targetLanguages.length === 0) return;

  const output =
    typeof input === "object"
      ? await translateMultiple(gcProjectId, input, targetLanguages)
      : await translateSingle(gcProjectId, input, targetLanguages);

  return snapshot.ref.update(outputFieldName, output);
};

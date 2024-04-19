import { v2 } from "@google-cloud/translate";
import * as logs from "../logs";
import * as events from "../events";
import * as admin from "firebase-admin";
import config from "../config";

export type Translation = {
  language: string;
  output: string;
};

export const translate = new v2.Translate({
  projectId: process.env.PROJECT_ID,
});

export const translateString = async (
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
    await events.recordErrorEvent(err as Error);
    throw err;
  }
};

export const extractInput = (
  snapshot: admin.firestore.DocumentSnapshot
): any => {
  return snapshot.get(config.inputFieldName);
};

export const extractOutput = (
  snapshot: admin.firestore.DocumentSnapshot
): any => {
  return snapshot.get(config.outputFieldName);
};

export const extractLanguages = (
  snapshot: admin.firestore.DocumentSnapshot
): string[] => {
  if (!config.languagesFieldName) return config.languages;
  return snapshot.get(config.languagesFieldName) || config.languages;
};

export const filterLanguagesFn = (
  existingTranslations: Record<string, any>
): ((targetLanguage: string) => boolean) => {
  return (targetLanguage: string) => {
    if (existingTranslations[targetLanguage] != undefined) {
      logs.skippingLanguage(targetLanguage);
      return false;
    }
    return true;
  };
};

export const updateTranslations = async (
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
  await events.recordSuccessEvent({
    subject: snapshot.ref.path,
    data: { outputFieldName: config.outputFieldName, translations },
  });
};

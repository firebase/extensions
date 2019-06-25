import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { Translate } from "@google-cloud/translate";

type Translation = {
  language: string;
  message: string;
};

const translate = new Translate({ projectId: process.env.PROJECT_ID });

// languages to be translated into
const LANGUAGES = process.env.LANGUAGES.split(",");
const MESSAGE_FIELD_NAME = process.env.MESSAGE_FIELD_NAME;
const TRANSLATIONS_FIELD_NAME = process.env.TRANSLATIONS_FIELD_NAME;

// Initializing firebase-admin
admin.initializeApp();

// Translate an incoming message.
export const fstranslate = functions.handler.firestore.document.onWrite(
  (change): Promise<void> => {
    if (!change.after.exists) {
      // Document was deleted, ignore
      console.log("Document was deleted, ignoring");
      return Promise.resolve();
    } else if (!change.before.exists) {
      // Document was created, check if message exists
      const msg = change.after.get(MESSAGE_FIELD_NAME);
      if (msg) {
        console.log("Document was created with message, translating");
        return translateDocument(change.after);
      } else {
        console.log("Document was created without a message, skipping");
        return Promise.resolve();
      }
    } else {
      // Document was updated, check if message has changed
      const msgAfter = change.after.get(MESSAGE_FIELD_NAME);
      const msgBefore = change.before.get(MESSAGE_FIELD_NAME);

      if (msgAfter === msgBefore) {
        console.log(
          "Document was updated, but message has not changed, skipping"
        );
        return Promise.resolve();
      }

      if (msgAfter) {
        console.log("Document was updated, message has changed, translating");
        return translateDocument(change.after);
      } else {
        console.log("Document was updated, no message exists, skipping");
        return Promise.resolve();
      }
    }
  }
);

const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const message: string = snapshot.get(MESSAGE_FIELD_NAME);

  const tasks = LANGUAGES.map(
    async (targetLanguage: string): Promise<Translation> => {
      const translatedMsg = await translateMessage(message, targetLanguage);
      return {
        language: targetLanguage,
        message: translatedMsg,
      };
    }
  );

  const translations = await Promise.all(tasks);
  const translationsMap: { [language: string]: string } = translations.reduce(
    (output, translation) => {
      output[translation.language] = translation.message;
      return output;
    },
    {}
  );

  // Update the document
  await snapshot.ref.update(TRANSLATIONS_FIELD_NAME, translationsMap);
};

const translateMessage = async (
  msg: string,
  targetLanguage: string
): Promise<string> => {
  const [translatedMsg] = await translate.translate(msg, targetLanguage);
  return translatedMsg;
};

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
import { Translate } from "@google-cloud/translate";

import config from "./config";
import * as logs from "./logs";

type Translation = {
  language: string;
  message: string;
};

enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

const translate = new Translate({ projectId: process.env.PROJECT_ID });

// Initialize the Firebase Admin SDK
admin.initializeApp();

logs.init();

export const fstranslate = functions.handler.firestore.document.onWrite(
  async (change): Promise<void> => {
    logs.start();

    if (config.messageFieldName === config.translationsFieldName) {
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
        default:
          throw new Error(`Invalid change type: ${changeType}`);
      }

      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

const extractMsg = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.messageFieldName);
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

const handleCreateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const msg = extractMsg(snapshot);
  if (msg) {
    logs.documentCreatedWithMsg();
    await translateDocument(snapshot);
  } else {
    logs.documentCreatedNoMsg();
  }
};

const handleDeleteDocument = (): void => {
  logs.documentDeleted();
};

const handleUpdateDocument = async (
  before: admin.firestore.DocumentSnapshot,
  after: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const msgAfter = extractMsg(after);
  const msgBefore = extractMsg(before);

  const msgHasChanged = msgAfter !== msgBefore;
  if (!msgHasChanged) {
    logs.documentUpdatedUnchangedMsg();
    return;
  }

  if (msgAfter) {
    logs.documentUpdatedChangedMsg();
    await translateDocument(after);
  } else if (msgBefore) {
    logs.documentUpdatedDeletedMsg();
    await updateTranslations(after, admin.firestore.FieldValue.delete());
  } else {
    logs.documentUpdatedNoMsg();
  }
};

const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const message: string = extractMsg(snapshot);

  logs.translateMsgAllLanguages(message, config.languages);

  const tasks = config.languages.map(
    async (targetLanguage: string): Promise<Translation> => {
      const translatedMsg = await translateMessage(message, targetLanguage);
      return {
        language: targetLanguage,
        message: translatedMsg,
      };
    }
  );

  try {
    const translations = await Promise.all(tasks);

    logs.translateMsgAllLanguagesComplete(message);

    const translationsMap: { [language: string]: string } = translations.reduce(
      (output, translation) => {
        output[translation.language] = translation.message;
        return output;
      },
      {}
    );

    await updateTranslations(snapshot, translationsMap);
  } catch (err) {
    logs.translateMsgAllLanguagesError(message, err);
    throw err;
  }
};

const translateMessage = async (
  msg: string,
  targetLanguage: string
): Promise<string> => {
  try {
    logs.translateMsg(msg, targetLanguage);

    const [translatedMsg] = await translate.translate(msg, targetLanguage);

    logs.translateMsgComplete(msg, targetLanguage);

    return translatedMsg;
  } catch (err) {
    logs.translateMsgError(msg, targetLanguage, err);
    throw err;
  }
};

const updateTranslations = async (
  snapshot: admin.firestore.DocumentSnapshot,
  translations: any
): Promise<void> => {
  logs.updateDocument(snapshot.ref.path);

  await snapshot.ref.update(config.translationsFieldName, translations);

  logs.updateDocumentComplete(snapshot.ref.path);
};

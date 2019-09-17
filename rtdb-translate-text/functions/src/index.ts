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
  language?: string;
  message: string;
  translated?: boolean;
};
type TranslationsMap = {
  [path: string]: Translation | null;
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

exports.rtdbtranslate = functions.handler.database.ref.onWrite(
  async (change) => {
    logs.start();

    const changeType = getChangeType(change);

    try {
      switch (changeType) {
        case ChangeType.CREATE:
          await handleCreateDocument(change.after);
          break;
        case ChangeType.DELETE:
          await handleDeleteDocument(change.after);
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

const extractMsg = (snapshot: admin.database.DataSnapshot): Translation => {
  return snapshot.val();
};

const getChangeType = (
  change: functions.Change<admin.database.DataSnapshot>
): ChangeType => {
  if (!change.after.exists()) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists()) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
};

const handleCreateDocument = async (
  snapshot: admin.database.DataSnapshot
): Promise<void> => {
  const msg = extractMsg(snapshot);
  if (msg.message) {
    if (msg.translated) {
      logs.documentCreatedAlreadyTranslated();
    } else {
      logs.documentCreatedWithMsg();
      await translateDocument(snapshot);
    }
  } else {
    logs.documentCreatedNoMsg();
  }
};

const handleDeleteDocument = async (
  snapshot: admin.database.DataSnapshot
): Promise<void> => {
  logs.documentDeleted();
  await removeTranslations(snapshot);
};

const handleUpdateDocument = async (
  before: admin.database.DataSnapshot,
  after: admin.database.DataSnapshot
): Promise<void> => {
  const msgAfter = extractMsg(after);
  const msgBefore = extractMsg(before);

  if (msgAfter.translated) {
    logs.documentUpdatedAlreadyTranslated();
    return;
  }

  const msgHasChanged = msgAfter.message !== msgBefore.message;
  if (!msgHasChanged) {
    logs.documentUpdatedUnchangedMsg();
    return;
  }

  if (msgAfter.message) {
    logs.documentUpdatedChangedMsg();
    await translateDocument(after);
  } else if (msgBefore.message) {
    logs.documentUpdatedDeletedMsg();
    await removeTranslations(after);
  } else {
    logs.documentUpdatedNoMsg();
  }
};

const removeTranslations = async (snapshot: admin.database.DataSnapshot) => {
  const translationsMap: TranslationsMap = config.languages.reduce(
    (output, language) => {
      output[`${config.triggerPath}/${language}/${snapshot.key}`] = null;
      return output;
    },
    {}
  );

  await updateTranslations(snapshot, translationsMap);
};

const translateDocument = async (
  snapshot: admin.database.DataSnapshot
): Promise<void> => {
  const message = extractMsg(snapshot);

  logs.translateMsgAllLanguages(message.message, config.languages);

  const tasks = config.languages.map(
    async (targetLanguage: string): Promise<Translation> => {
      const translatedMsg = await translateMessage(
        message.message,
        targetLanguage
      );
      return {
        language: targetLanguage,
        message: translatedMsg,
        translated: true,
      };
    }
  );

  try {
    const translations = await Promise.all(tasks);

    logs.translateMsgAllLanguagesComplete(message.message);

    const translationsMap: TranslationsMap = translations.reduce(
      (output: TranslationsMap, translation) => {
        output[
          `${config.triggerPath}/${translation.language}/${snapshot.key}`
        ] = translation;
        return output;
      },
      {}
    );

    await updateTranslations(snapshot, translationsMap);
  } catch (err) {
    logs.translateMsgAllLanguagesError(message.message, err);
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
  snapshot: admin.database.DataSnapshot,
  translationsMap: TranslationsMap
): Promise<void> => {
  logs.updateDocument(snapshot.key);

  await admin
    .database()
    .ref()
    .update(translationsMap);

  logs.updateDocumentComplete(snapshot.key);
};

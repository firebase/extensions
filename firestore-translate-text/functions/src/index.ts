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
import * as validators from "./validators";

type Translation = {
  language: string;
  output: {
    string: string;
    language: string;
  };
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

    const { languages, inputFieldName, outputFieldName } = config;

    if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
      logs.fieldNamesNotDifferent();
      return;
    }

    if (
      validators.fieldNameIsTranslationPath(
        inputFieldName,
        outputFieldName,
        languages
      )
    ) {
      logs.inputFieldNameIsOutputPath();
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

const extractInput = (snapshot: admin.firestore.DocumentSnapshot): any => {
  return snapshot.get(config.inputFieldName);
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
  const inputAfter = extractInput(after);
  const inputBefore = extractInput(before);

  const inputHasChanged = inputAfter !== inputBefore;
  if (!inputHasChanged) {
    logs.documentUpdatedUnchangedInput();
    return;
  }

  if (inputAfter) {
    logs.documentUpdatedChangedInput();
    await translateDocument(after);
  } else if (inputBefore) {
    logs.documentUpdatedDeletedInput();
    await updateTranslations(after, admin.firestore.FieldValue.delete());
  } else {
    logs.documentUpdatedNoInput();
  }
};

const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const input: string = extractInput(snapshot);

  logs.translateInputStringToAllLanguages(input, config.languages);

  const tasks = config.languages.map(
    async (targetLanguage: string): Promise<Translation> => {
      return {
        language: targetLanguage,
        output: await translateString(input, targetLanguage),
      };
    }
  );

  try {
    const translations = (await Promise.all(tasks)).filter(
      ({ language, output }): boolean => {
        if (config.shouldUpdate) {
          return true;
        }
        return output.language === language;
      }
    );

    logs.translateInputToAllLanguagesComplete(input);

    const translationsMap: { [language: string]: string } = translations.reduce(
      (output, translation) => {
        output[translation.language] = translation.output;
        return output;
      },
      {}
    );

    await updateTranslations(snapshot, translationsMap);
  } catch (err) {
    logs.translateInputToAllLanguagesError(input, err);
    throw err;
  }
};

const translateString = async (
  string: string,
  targetLanguage: string
): Promise<Translation["output"]> => {
  try {
    logs.translateInputString(string, targetLanguage);

    const [translatedString] = await translate.translate(
      string,
      targetLanguage
    );

    logs.translateStringComplete(string, targetLanguage);

    const [prediction] = await translate.detect(string);
    return { string: translatedString, language: prediction.language };
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

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

import { logger } from "firebase-functions";
import { messages } from "./messages";

export const complete = () => {
  logger.log(messages.complete());
};

export const documentCreatedNoInput = () => {
  logger.log(messages.documentCreatedNoInput());
};

export const documentCreatedWithInput = () => {
  logger.log(messages.documentCreatedWithInput());
};

export const documentFoundWithInput = () => {
  logger.log(messages.documentFoundWithInput());
};

export const documentFoundNoInput = () => {
  logger.log(messages.documentFoundNoInput());
};

export const documentDeleted = () => {
  logger.log(messages.documentDeleted());
};

export const documentUpdatedChangedInput = () => {
  logger.log(messages.documentUpdatedChangedInput());
};

export const documentUpdatedDeletedInput = () => {
  logger.log(messages.documentUpdatedDeletedInput());
};

export const documentUpdatedNoInput = () => {
  logger.log(messages.documentUpdatedNoInput());
};

export const documentUpdatedUnchangedInput = () => {
  logger.log(messages.documentUpdatedUnchangedInput());
};

export const error = (err: Error) => {
  logger.error(...messages.error(err));
};

export const fieldNamesNotDifferent = () => {
  logger.error(messages.fieldNamesNotDifferent());
};

export const init = (config) => {
  logger.log(...messages.init(config));
};

export const inputFieldNameIsOutputPath = () => {
  logger.error(messages.inputFieldNameIsOutputPath());
};

export const start = (config) => {
  logger.log(...messages.start(config));
};

export const translateInputString = (string: string, language: string) => {
  logger.log(messages.translateInputString(string, language));
};

export const translateStringComplete = (
  string: string,
  language: string,
  translatedString: string
) => {
  logger.log(
    messages.translateStringComplete(string, language, translatedString)
  );
};

export const translateStringError = (
  string: string,
  language: string,
  err: Error
) => {
  logger.error(...messages.translateStringError(string, language, err));
};

export const translateInputStringToAllLanguages = (
  string: string,
  languages: string[]
) => {
  logger.log(messages.translateInputStringToAllLanguages(string, languages));
};

export const translateInputToAllLanguagesComplete = (string: string) => {
  logger.log(messages.translateInputToAllLanguagesComplete(string));
};

export const partialTranslateError = (
  input: string,
  reasons: string[],
  numLanguages: number
) => {
  logger.error(messages.partialTranslateError(input, reasons, numLanguages));
};

export const translateInputToAllLanguagesError = (
  string: string,
  err: Error
) => {
  logger.error(...messages.translateInputToAllLanguagesError(string, err));
};

export const updateDocument = (path: string) => {
  logger.log(messages.updateDocument(path));
};

export const updateDocumentComplete = (path: string) => {
  logger.log(messages.updateDocumentComplete(path));
};

export const backfillComplete = (successCount: number, errorCount: number) => {
  logger.log(messages.backfillComplete(successCount, errorCount));
};

export const skippingLanguage = (language: string) => {
  logger.log(messages.skippingLanguage(language));
};

export const enqueueNext = (offset: number) => {
  logger.log(messages.enqueueNext(offset));
};

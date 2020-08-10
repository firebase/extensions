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

import config from "../config";
import { messages } from "./messages";

export const complete = () => {
  console.log(messages.complete());
};

export const documentCreatedNoInput = () => {
  console.log(messages.documentCreatedNoInput());
};

export const documentCreatedWithInput = () => {
  console.log(messages.documentCreatedWithInput());
};

export const documentDeleted = () => {
  console.log(messages.documentDeleted());
};

export const documentUpdatedChangedInput = () => {
  console.log(messages.documentUpdatedChangedInput());
};

export const documentUpdatedDeletedInput = () => {
  console.log(messages.documentUpdatedDeletedInput());
};

export const documentUpdatedNoInput = () => {
  console.log(messages.documentUpdatedNoInput());
};

export const documentUpdatedUnchangedInput = () => {
  console.log(messages.documentUpdatedUnchangedInput());
};

export const error = (err: Error) => {
  console.error(...messages.error(err));
};

export const fieldNamesNotDifferent = () => {
  console.error(messages.fieldNamesNotDifferent());
};

export const init = () => {
  console.log(...messages.init(config));
};

export const inputFieldNameIsOutputPath = () => {
  console.error(messages.inputFieldNameIsOutputPath());
};

export const start = () => {
  console.log(...messages.start(config));
};

export const translateInputString = (string: string, language: string) => {
  console.log(messages.translateInputString(string, language));
};

export const translateStringComplete = (string: string, language: string) => {
  console.log(messages.translateStringComplete(string, language));
};

export const translateStringError = (
  string: string,
  language: string,
  err: Error
) => {
  console.error(...messages.translateStringError(string, language, err));
};

export const translateInputStringToAllLanguages = (
  string: string,
  languages: string[]
) => {
  console.log(messages.translateInputStringToAllLanguages(string, languages));
};

export const translateInputToAllLanguagesComplete = (string: string) => {
  console.log(messages.translateInputToAllLanguagesComplete(string));
};

export const translateInputToAllLanguagesError = (
  string: string,
  err: Error
) => {
  console.error(...messages.translateInputToAllLanguagesError(string, err));
};

export const updateDocument = (path: string) => {
  console.log(...messages.updateDocument(path));
};

export const updateDocumentComplete = (path: string) => {
  console.log(...messages.updateDocumentComplete(path));
};

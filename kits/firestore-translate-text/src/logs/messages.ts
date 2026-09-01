/**
 * Copyright 2026 Google LLC
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

export const messages = {
  complete: () => "Completed execution of extension",
  documentCreatedNoInput: () =>
    "Document was created without an input string, no processing is required",
  documentCreatedWithInput: () => "Document was created with an input string",
  documentDeleted: () => "Document was deleted, no processing is required",
  documentUpdatedChangedInput: () =>
    "Document was updated, input string has changed",
  documentUpdatedDeletedInput: () =>
    "Document was updated, input string was deleted",
  documentUpdatedNoInput: () =>
    "Document was updated, no input string exists, no processing is required",
  documentUpdatedUnchangedInput: () =>
    "Document was updated, input string has not changed, no processing is required",
  error: (err: Error) => ["Failed execution of extension", err],
  fieldNamesNotDifferent: () =>
    "The `Input` and `Output` field names must be different for this extension to function correctly",
  init: (config = {}) => [
    "Initializing extension with the parameter values",
    config,
  ],
  inputFieldNameIsOutputPath: () =>
    "The `Input` field name must not be the same as an `Output` path for this extension to function correctly",
  start: (config = {}) => [
    "Started execution of extension with configuration",
    config,
  ],
  translateStringComplete: (
    string: string,
    language: string,
    translated: string
  ) =>
    `Finished translating string: '${string}' into language(s): '${language}' : '${translated}'`,
  translateStringError: (string: string, language: string, err: Error) => [
    `Error when translating string: '${string}' into language(s): '${language}'`,
    err,
  ],
  translateInputStringToAllLanguages: (string: string, languages: string[]) =>
    `Translating string: '${string}' into language(s): '${languages.join(
      ","
    )}'`,
  translateInputToAllLanguagesComplete: (string: string) =>
    `Finished translating string: '${string}'`,
  translateInputToAllLanguagesError: (string: string, err: Error) => [
    `Error when translating string: '${string}'`,
    err,
  ],
  updateDocument: (path: string) =>
    `Updating Cloud Firestore document: '${path}'`,
  updateDocumentComplete: (path: string) =>
    `Finished updating Cloud Firestore document: '${path}'`,
};

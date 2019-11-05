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

import config from "./config";

export const complete = () => {
  console.log("Completed execution of extension");
};

export const documentCreatedNoInput = () => {
  console.log(
    "Document was created without an input string, no processing is required"
  );
};

export const documentCreatedWithInput = () => {
  console.log("Document was created with an input string");
};

export const documentDeleted = () => {
  console.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedInput = () => {
  console.log("Document was updated, input string has changed");
};

export const documentUpdatedDeletedInput = () => {
  console.log("Document was updated, input string was deleted");
};

export const documentUpdatedNoInput = () => {
  console.log(
    "Document was updated, no input string exists, no processing is required"
  );
};

export const documentUpdatedUnchangedInput = () => {
  console.log(
    "Document was updated, input string has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  console.error("Failed execution of extension", err);
};

export const fieldNamesNotDifferent = () => {
  console.error(
    "The `Input` and `Output` field names must be different for this extension to function correctly"
  );
};

export const init = () => {
  console.log("Initializing extension with configuration", config);
};

export const inputFieldNameIsOutputPath = () => {
  console.error(
    "The `Input` field name must not be the same as an `Output` path for this extension to function correctly"
  );
};

export const start = () => {
  console.log("Started execution of extension with configuration", config);
};

export const translateInputString = (string: string, language: string) => {
  console.log(
    `Translating string: '${string}' into language(s): '${language}'`
  );
};

export const translateStringComplete = (string: string, language: string) => {
  console.log(
    `Finished translating string: '${string}' into language(s): '${language}'`
  );
};

export const translateStringError = (
  string: string,
  language: string,
  err: Error
) => {
  console.error(
    `Error when translating string: '${string}' into language(s): '${language}'`,
    err
  );
};

export const translateInputStringToAllLanguages = (
  string: string,
  languages: string[]
) => {
  console.log(
    `Translating string: '${string}' into language(s): '${languages.join(",")}'`
  );
};

export const translateInputToAllLanguagesComplete = (string: string) => {
  console.log(`Finished translating string: '${string}'`);
};

export const translateInputToAllLanguagesError = (
  string: string,
  err: Error
) => {
  console.error(`Error when translating string: '${string}'`, err);
};

export const updateDocument = (path: string) => {
  console.log(`Updating Cloud Firestore document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  console.log(`Finished updating Cloud Firestore document: '${path}'`);
};

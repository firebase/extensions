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

export const documentCreatedNoMsg = () => {
  console.log(
    "Document was created without a string, no processing is required"
  );
};

export const documentCreatedWithMsg = () => {
  console.log("Document was created with a string");
};

export const documentDeleted = () => {
  console.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedMsg = () => {
  console.log("Document was updated, string has changed");
};

export const documentUpdatedDeletedMsg = () => {
  console.log("Document was updated, string was deleted");
};

export const documentUpdatedNoMsg = () => {
  console.log(
    "Document was updated, no string exists, no processing is required"
  );
};

export const documentUpdatedUnchangedMsg = () => {
  console.log(
    "Document was updated, string has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  console.error("Failed execution of extension", err);
};

export const fieldNamesNotDifferent = () => {
  console.error(
    "The `Message` and `Translations` field names must be different for this extension to function correctly"
  );
};

export const init = () => {
  console.log("Initializing extension with configuration", config);
};

export const messageFieldNameIsTranslationPath = () => {
  console.error(
    "The `Message` field name must not be the same as a `Translation` path for this extension to function correctly"
  );
};

export const start = () => {
  console.log("Started execution of extension with configuration", config);
};

export const translateMsg = (msg: string, language: string) => {
  console.log(`Translating msg: '${msg}' into language(s): '${language}'`);
};

export const translateMsgComplete = (msg: string, language: string) => {
  console.log(
    `Finished translating msg: '${msg}' into language(s): '${language}'`
  );
};

export const translateMsgError = (
  msg: string,
  language: string,
  err: Error
) => {
  console.error(
    `Error when translating msg: '${msg}' into language(s): '${language}'`,
    err
  );
};

export const translateMsgAllLanguages = (msg: string, languages: string[]) => {
  console.log(
    `Translating msg: '${msg}' into language(s): '${languages.join(",")}'`
  );
};

export const translateMsgAllLanguagesComplete = (msg: string) => {
  console.log(`Finished translating msg: '${msg}'`);
};

export const translateMsgAllLanguagesError = (msg: string, err: Error) => {
  console.error(`Error when translating msg: '${msg}'`, err);
};

export const updateDocument = (path: string) => {
  console.log(`Updating Cloud Firestore document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  console.log(`Finished updating Cloud Firestore document: '${path}'`);
};

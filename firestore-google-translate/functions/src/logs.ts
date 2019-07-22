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
  console.log("Completed mod execution");
};

export const documentCreatedNoMsg = () => {
  console.log(
    "Document was created without a message, no processing is required"
  );
};

export const documentCreatedWithMsg = () => {
  console.log("Document was created with a message");
};

export const documentDeleted = () => {
  console.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedMsg = () => {
  console.log("Document was updated, message has changed");
};

export const documentUpdatedDeletedMsg = () => {
  console.log("Document was updated, message was deleted");
};

export const documentUpdatedNoMsg = () => {
  console.log(
    "Document was updated, no message exists, no processing is required"
  );
};

export const documentUpdatedUnchangedMsg = () => {
  console.log(
    "Document was updated, message has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  console.error("Failed mod execution", err);
};

export const fieldNamesNotDifferent = () => {
  console.error(
    "The `Message` and `Translations` field names must be different for this mod to function correctly"
  );
};

export const init = () => {
  console.log("Initializing mod with configuration", config);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const translateMsg = (msg: string, language: string) => {
  console.log(`Translating msg: '${msg}' into language: '${language}'`);
};

export const translateMsgComplete = (msg: string, language: string) => {
  console.log(
    `Finished translating msg: '${msg}' into language: '${language}'`
  );
};

export const translateMsgError = (
  msg: string,
  language: string,
  err: Error
) => {
  console.error(
    `Error translating msg: '${msg}' into language: '${language}'`,
    err
  );
};

export const translateMsgAllLanguages = (msg: string, languages: string[]) => {
  console.log(
    `Translating msg: '${msg}' into languages: '${languages.join(",")}'`
  );
};

export const translateMsgAllLanguagesComplete = (msg: string) => {
  console.log(`Finished translating msg: '${msg}'`);
};

export const translateMsgAllLanguagesError = (msg: string, err: Error) => {
  console.error(`Error translating msg: '${msg}'`, err);
};

export const updateDocument = (path: string) => {
  console.log(`Updating Firestore Document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  console.log(`Finished updating Firestore Document: '${path}'`);
};

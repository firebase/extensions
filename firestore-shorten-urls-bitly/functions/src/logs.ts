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
import config from "./config";

const obfuscatedConfig = {
  ...config,
  bitlyAccessToken: "********",
};

export const complete = () => {
  logger.log("Completed execution of extension");
};

export const documentCreatedNoUrl = () => {
  logger.log("Document was created without a URL, no processing is required");
};

export const documentCreatedWithUrl = () => {
  logger.log("Document was created with a URL");
};

export const documentDeleted = () => {
  logger.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedUrl = () => {
  logger.log("Document was updated, URL has changed");
};

export const documentUpdatedDeletedUrl = () => {
  logger.log("Document was updated, URL was deleted");
};

export const documentUpdatedNoUrl = () => {
  logger.log("Document was updated, no URL exists, no processing is required");
};

export const documentUpdatedUnchangedUrl = () => {
  logger.log(
    "Document was updated, URL has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  logger.error("Error when shortening URL", err);
};

export const fieldNamesNotDifferent = () => {
  logger.error(
    "The `URL` and `Short URL` field names must be different for this extension to function correctly"
  );
};

export const init = () => {
  logger.log("Initializing extension with configuration", obfuscatedConfig);
};

export const shortenUrl = (url: string) => {
  logger.log(`Shortening URL: '${url}'`);
};

export const shortenUrlComplete = (shortUrl: string) => {
  logger.log(`Finished shortening URL to: '${shortUrl}'`);
};

export const start = () => {
  logger.log(
    "Started execution of extension with configuration",
    obfuscatedConfig
  );
};

export const updateDocument = (path: string) => {
  logger.log(`Updating Cloud Firestore document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  logger.log(`Finished updating Cloud Firestore document: '${path}'`);
};

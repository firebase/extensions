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
import * as functions from "firebase-functions";
import config from "./config";

export const complete = () => {
  functions.logger.log("Completed execution of extension");
};

export const documentCreatedNoUrl = () => {
  functions.logger.log(
    "Document was created without a URL, so no processing is required"
  );
};

export const documentCreatedWithUrl = () => {
  functions.logger.log("Document was created with a URL");
};

export const documentUpdatedChangedUrl = () => {
  functions.logger.log("Document was updated: URL has changed");
};

export const documentUpdatedDeletedUrl = () => {
  functions.logger.log("Document was updated: URL was deleted");
};

export const documentUpdatedNoUrl = () => {
  functions.logger.log(
    "Document was updated: no URL exists, so no processing is required"
  );
};

export const documentUpdatedUnchangedUrl = () => {
  functions.logger.log(
    "Document was updated: URL has not changed, so no processing is required"
  );
};

export const error = (err: Error) => {
  functions.logger.error("Error when shortening URL", err);
};

export const fieldNamesNotDifferent = () => {
  functions.logger.error(
    "The `URL` and `Short URL` field names must be different"
  );
};

export const init = () => {
  functions.logger.log("Initializing extension with configuration", config);
};

export const shortenUrl = (url: string) => {
  functions.logger.log(`Shortening URL: '${url}'`);
};

export const shortenUrlComplete = (shortUrl: string) => {
  functions.logger.log(`Finished shortening URL to: '${shortUrl}'`);
};

export const start = () => {
  functions.logger.log(
    "Started execution of extension with configuration",
    config
  );
};

export const updateDocument = (path: string) => {
  functions.logger.log(`Updating Cloud Firestore document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  functions.logger.log(`Finished updating Cloud Firestore document: '${path}'`);
};

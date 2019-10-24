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

export const documentCreatedNoUrl = () => {
  console.log("Document was created without a URL, no processing is required");
};

export const documentCreatedWithUrl = () => {
  console.log("Document was created with a URL");
};

export const documentDeleted = () => {
  console.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedUrl = () => {
  console.log("Document was updated, URL has changed");
};

export const documentUpdatedDeletedUrl = () => {
  console.log("Document was updated, URL was deleted");
};

export const documentUpdatedNoUrl = () => {
  console.log("Document was updated, no URL exists, no processing is required");
};

export const documentUpdatedUnchangedUrl = () => {
  console.log(
    "Document was updated, URL has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  console.error("Error when shortening URL", err);
};

export const fieldNamesNotDifferent = () => {
  console.error(
    "The `URL` and `Short URL` field names must be different for this extension to function correctly"
  );
};

export const init = () => {
  console.log("Initializing extension with configuration", config);
};

export const shortenUrl = (url: string) => {
  console.log(`Shortening URL: '${url}'`);
};

export const shortenUrlComplete = (shortUrl: string) => {
  console.log(`Finished shortening URL to: '${shortUrl}'`);
};

export const start = () => {
  console.log("Started execution of extension with configuration", config);
};

export const updateDocument = (path: string) => {
  console.log(`Updating Cloud Firestore document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  console.log(`Finished updating Cloud Firestore document: '${path}'`);
};

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

export const accessTokenLoaded = () => {
  console.log("Loaded access token");
};

export const accessTokenLoading = () => {
  console.log("Loading access token");
};

export const branchSkip = (requestedBranch: string, expectedBranch: string) => {
  console.log(
    `Branch: '${requestedBranch}' does not match the deployment branch: '${expectedBranch}', no processing required`
  );
};

export const commitLoaded = (commit: string) => {
  console.log(`Loaded commit: '${commit}'`);
};

export const commitLoading = (commit: string) => {
  console.log(`Loading commit: '${commit}'`);
};

export const complete = () => {
  console.log("Completed execution of extension");
};

export const deploymentManifest = (manifest: string) => {
  console.log(`Deployment manifest: ${manifest}`);
};

export const error = (err: Error) => {
  console.error("Error when deploying site", err);
};

export const errorDeleting = (err: Error) => {
  console.warn("Error when deleting temporary files", err);
};

export const filesPublished = () => {
  console.log("Published files to Firebase Hosting");
};

export const filesPublishing = () => {
  console.log("Publishing files to Firebase Hosting");
};

export const fileUploaded = (hash: string) => {
  console.log(`Uploaded file: ${hash}`);
};

export const fileUploading = (hash: string) => {
  console.log(`Uploading file: ${hash}`);
};

export const init = () => {
  console.log("Initializing extension with configuration", config);
};

export const repositoryCloned = (repository: string, path: string) => {
  console.log(`Cloned repository: '${repository}' to path: '${path}'`);
};

export const repositoryCloning = (repository: string, path: string) => {
  console.log(`Cloning repository: '${repository}' to path: '${path}'`);
};

export const requestedFilesLoaded = (files: string) => {
  console.log(`Loaded files requested by Firebase Hosting: ${files}`);
};

export const requestedFilesLoading = () => {
  console.log(`Loading files requested by Firebase Hosting`);
};

export const released = (version: string) => {
  console.log(`Released version: '${version}' to Firebase Hosting`);
};

export const releasing = (version: string) => {
  console.log(`Releasing version: '${version}' to Firebase Hosting`);
};

export const start = () => {
  console.log("Started execution of extension with configuration", config);
};

export const tempFilesDeleted = () => {
  console.log("Deleted temporary files");
};

export const tempFilesDeleting = () => {
  console.log("Deleting temporary files");
};

export const uploadFinalized = () => {
  console.log("Finalized upload with Firebase Hosting");
};

export const uploadFinalizing = () => {
  console.log("Finalizing upload with Firebase Hosting");
};

export const versionLoaded = (version: string) => {
  console.log(`Loaded Firebase Hosting site version: '${version}'`);
};

export const versionLoading = () => {
  console.log("Loading Firebase Hosting site version");
};

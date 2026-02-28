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

export const complete = (uid: string) => {
  logger.log(`Successfully removed data for user: ${uid}`);
};

export const firestoreDeleted = () => {
  logger.log("Finished deleting user data from Cloud Firestore");
};

export const firestoreDeleting = () => {
  logger.log("Deleting user data from Cloud Firestore");
};

export const firestoreNotConfigured = () => {
  logger.log("Cloud Firestore paths are not configured, skipping");
};

export const firestorePathDeleted = (path: string, recursive: boolean) => {
  logger.log(
    `Deleted: '${path}' from Cloud Firestore ${
      recursive ? "with recursive delete" : ""
    }`
  );
};

export const firestorePathDeleting = (path: string, recursive: boolean) => {
  logger.log(
    `Deleting: '${path}' from Cloud Firestore ${
      recursive ? "with recursive delete" : ""
    }`
  );
};

export const firestorePathError = (path: string, err: Error) => {
  logger.error(`Error when deleting: '${path}' from Cloud Firestore`, err);
};

export const init = () => {
  logger.log("Initializing extension with configuration", config);
};

export const rtdbDeleted = () => {
  logger.log("Finished deleting user data from the Realtime Database");
};

export const rtdbDeleting = () => {
  logger.log("Deleting user data from the Realtime Database");
};

export const rtdbPathDeleted = (path: string) => {
  logger.log(`Deleted: '${path}' from the Realtime Database`);
};

export const rtdbNotConfigured = () => {
  logger.log("Realtime Database paths are not configured, skipping");
};

export const rtdbPathDeleting = (path: string) => {
  logger.log(`Deleting: '${path}' from the Realtime Database`);
};

export const rtdbPathError = (path: string, err: Error) => {
  logger.error(
    `Error when deleting: '${path}' from the Realtime Database`,
    err
  );
};

export const start = () => {
  logger.log("Started extension execution with configuration", config);
};

export const storageDeleted = () => {
  logger.log("Finished deleting user data from Cloud Storage");
};

export const storageDeleting = () => {
  logger.log("Deleting user data from Cloud Storage");
};

export const storageNotConfigured = () => {
  logger.log("Cloud Storage paths are not configured, skipping");
};

export const storagePathDeleted = (path: string) => {
  logger.log(`Deleted: '${path}' from Cloud Storage`);
};

export const storagePathDeleting = (path: string) => {
  logger.log(`Deleting: '${path}' from Cloud Storage`);
};

export const storagePath404 = (path: string) => {
  logger.log(`File: '${path}' does not exist in Cloud Storage, skipping`);
};

export const storagePathError = (path: string, err: Error) => {
  logger.error(`Error deleting: '${path}' from Cloud Storage`, err);
};

export const customFunctionError = (err: Error) => {
  logger.error(`Call to custom hook function threw an error`, err);
};

export function warnInvalidPaths(invalidPathCount: number, uid: string) {
  logger.warn(
    `Attempted to delete ${invalidPathCount} invalid paths for deleted user ${uid}`
  );
}

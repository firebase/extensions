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

export const complete = (uid: string) => {
  console.log(`Successfully removed data for user: ${uid}`);
};

export const firestoreDeleted = () => {
  console.log("Finished deleting user data from Cloud Firestore");
};

export const firestoreDeleting = () => {
  console.log("Deleting user data from Cloud Firestore");
};

export const firestoreNotConfigured = () => {
  console.log("Cloud Firestore paths are not configured, skipping");
};

export const firestorePathDeleted = (path: string, recursive: boolean) => {
  console.log(`Deleted: '${path}' from Cloud Firestore ${recursive ? 'with recursive delete' : ''}`);
};

export const firestorePathDeleting = (path: string, recursive: boolean) => {
  console.log(`Deleting: '${path}' from Cloud Firestore ${recursive ? 'with recursive delete' : ''}`);
};

export const firestorePathError = (path: string, err: Error) => {
  console.error(`Error when deleting: '${path}' from Cloud Firestore`, err);
};

export const init = () => {
  console.log("Initializing extension with configuration", config);
};

export const rtdbDeleted = () => {
  console.log("Finished deleting user data from the Realtime Database");
};

export const rtdbDeleting = () => {
  console.log("Deleting user data from the Realtime Database");
};

export const rtdbPathDeleted = (path: string) => {
  console.log(`Deleted: '${path}' from the Realtime Database`);
};

export const rtdbNotConfigured = () => {
  console.log("Realtime Database paths are not configured, skipping");
};

export const rtdbPathDeleting = (path: string) => {
  console.log(`Deleting: '${path}' from the Realtime Database`);
};

export const rtdbPathError = (path: string, err: Error) => {
  console.error(`Error when deleting: '${path}' from the Realtime Database`, err);
};

export const start = () => {
  console.log("Started extension execution with configuration", config);
};

export const storageDeleted = () => {
  console.log("Finished deleting user data from Cloud Storage");
};

export const storageDeleting = () => {
  console.log("Deleting user data from Cloud Storage");
};

export const storageNotConfigured = () => {
  console.log("Cloud Storage paths are not configured, skipping");
};

export const storagePathDeleted = (path: string) => {
  console.log(`Deleted: '${path}' from Cloud Storage`);
};

export const storagePathDeleting = (path: string) => {
  console.log(`Deleting: '${path}' from Cloud Storage`);
};

export const storagePath404 = (path: string) => {
  console.log(`File: '${path}' does not exist in Cloud Storage, skipping`);
};

export const storagePathError = (path: string, err: Error) => {
  console.error(`Error deleting: '${path}' from Cloud Storage`, err);
};

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
import * as firebase from "firebase-admin";
import config from "./config";

export const complete = () => {
  console.log("Completed mod execution");
};

export const deviceInvalid = (userId: string, deviceId: string) => {
  console.log(
    `User: ${userId} has an invalid device: ${deviceId} which will be removed`
  );
};

export const error = (err: Error) => {
  console.error("Error sending notifications", err);
};

export const init = () => {
  console.log("Initializing mod with configuration", config);
};

export const invalidDevicesRemoved = () => {
  console.log("Removed all invalid devices");
};

export const invalidDevicesRemoving = () => {
  console.log("Removing all invalid devices");
};

export const notificationBatchSending = (
  batch: number,
  totalBatches: number
) => {
  console.log(`Sending notification to batch ${batch} of ${totalBatches}`);
};

export const notificationBatchSent = (batch: number, totalBatches: number) => {
  console.log(`Sent notification to batch ${batch} of ${totalBatches}`);
};

export const notificationError = (
  userId: string,
  deviceId: string,
  error: firebase.FirebaseError
) => {
  console.error(
    `Failed to send notification to user: ${userId} device: ${deviceId}`,
    error
  );
};

export const notificationSending = (userIds: string[], tokens: string[]) => {
  console.log(
    `Sending notification to ${tokens.length} device(s) for ${userIds.length} user(s)`
  );
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const tokensLoaded = (userIds: string[]) => {
  console.log(`Loaded tokens for users: ${JSON.stringify(userIds)}`);
};

export const tokensLoading = (userIds: string[]) => {
  console.log(`Loading tokens for users: ${JSON.stringify(userIds)}`);
};

export const tokensNotFound = (userIds: string[]) => {
  console.log(`No tokens were found for users: ${JSON.stringify(userIds)}`);
};

export const userMissing = () => {
  console.warn("Notification is missing a `userId` or `userIds` property");
};

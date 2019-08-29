"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.complete = () => {
  console.log("Completed mod execution");
};
exports.deviceInvalid = (userId, deviceId) => {
  console.log(
    `User: ${userId} has an invalid device: ${deviceId} which will be removed`
  );
};
exports.error = (err) => {
  console.error("Error sending notifications", err);
};
exports.init = () => {
  console.log("Initializing mod with configuration", config_1.default);
};
exports.invalidDevicesRemoved = () => {
  console.log("Removed all invalid devices");
};
exports.invalidDevicesRemoving = () => {
  console.log("Removing all invalid devices");
};
exports.notificationBatchSending = (batch, totalBatches) => {
  console.log(`Sending notification to batch ${batch} of ${totalBatches}`);
};
exports.notificationBatchSent = (batch, totalBatches) => {
  console.log(`Sent notification to batch ${batch} of ${totalBatches}`);
};
exports.notificationError = (userId, deviceId, error) => {
  console.error(
    `Failed to send notification to user: ${userId} device: ${deviceId}`,
    error
  );
};
exports.notificationSending = (userIds, tokens) => {
  console.log(
    `Sending notification to ${tokens.length} device(s) for ${userIds.length} user(s)`
  );
};
exports.start = () => {
  console.log("Started mod execution with configuration", config_1.default);
};
exports.tokensLoaded = (userIds) => {
  console.log(`Loaded tokens for users: ${JSON.stringify(userIds)}`);
};
exports.tokensLoading = (userIds) => {
  console.log(`Loading tokens for users: ${JSON.stringify(userIds)}`);
};
exports.tokensNotFound = (userIds) => {
  console.log(`No tokens were found for users: ${JSON.stringify(userIds)}`);
};
exports.userMissing = () => {
  console.warn("Notification is missing a `userId` or `userIds` property");
};

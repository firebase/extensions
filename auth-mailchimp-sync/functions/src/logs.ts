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

export const obfuscatedConfig = {
  ...config,
  mailchimpApiKey: "<omitted>",
};

export const complete = () => {
  logger.log("Completed execution of extension");
};

export const errorAddUser = (err: Error) => {
  logger.error("Error when adding user to Mailchimp audience", err);
};

export const errorRemoveUser = (err: Error) => {
  logger.error("Error when removing user from Mailchimp audience", err);
};

export const init = () => {
  logger.log("Initializing extension with configuration", obfuscatedConfig);
};

export const initError = (err: Error) => {
  logger.error("Error when initializing extension", err);
};

export const mailchimpNotInitialized = () => {
  logger.error(
    "Mailchimp was not initialized correctly, check for errors in the logs"
  );
};

export const start = () => {
  logger.log(
    "Started execution of extension with configuration",
    obfuscatedConfig
  );
};

export const userAdded = (
  userId: string,
  audienceId: string,
  mailchimpId: string,
  status: string
) => {
  logger.log(
    `Added user: ${userId} with status '${status}' to Mailchimp audience: ${audienceId} with Mailchimp ID: ${mailchimpId}`
  );
};

export const userAdding = (userId: string, audienceId: string) => {
  logger.log(`Adding user: ${userId} to Mailchimp audience: ${audienceId}`);
};

export const userNoEmail = () => {
  logger.log("User does not have an email");
};

export const userRemoved = (
  userId: string,
  hashedEmail: string,
  audienceId: string
) => {
  logger.log(
    `Removed user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`
  );
};

export const userRemoving = (
  userId: string,
  hashedEmail: string,
  audienceId: string
) => {
  logger.log(
    `Removing user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`
  );
};

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

import * as crypto from "crypto";
import * as functions from "firebase-functions";
// @ts-ignore incorrect typescript typings
import * as Mailchimp from "mailchimp-api-v3";

import config from "./config";
import * as logs from "./logs";

logs.init();

let mailchimp: Mailchimp;
try {
  mailchimp = new Mailchimp(config.mailchimpApiKey);
} catch (err) {
  logs.initError(err);
}

export const addUserToList = functions.handler.auth.user.onCreate(
  async (user): Promise<void> => {
    logs.start();

    if (!mailchimp) {
      logs.mailchimpNotInitialized();
      return;
    }

    const { email, uid } = user;
    if (!email) {
      logs.userNoEmail();
      return;
    }

    try {
      logs.userAdding(uid, config.mailchimpAudienceId);
      const results = await mailchimp.post(
        `/lists/${config.mailchimpAudienceId}/members`,
        {
          email_address: email,
          status: config.mailchimpContactStatus,
        }
      );
      logs.userAdded(
        uid,
        config.mailchimpAudienceId,
        results.id,
        config.mailchimpContactStatus
      );
      logs.complete();
    } catch (err) {
      logs.errorAddUser(err);
    }
  }
);

export const removeUserFromList = functions.handler.auth.user.onDelete(
  async (user): Promise<void> => {
    logs.start();

    if (!mailchimp) {
      logs.mailchimpNotInitialized();
      return;
    }

    const { email, uid } = user;
    if (!email) {
      logs.userNoEmail();
      return;
    }

    try {
      const hashed = crypto
        .createHash("md5")
        .update(email)
        .digest("hex");

      logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
      await mailchimp.delete(
        `/lists/${config.mailchimpAudienceId}/members/${hashed}`
      );
      logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
      logs.complete();
    } catch (err) {
      logs.errorRemoveUser(err);
    }
  }
);

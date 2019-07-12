/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import * as crypto from "crypto";
import * as functions from "firebase-functions";
// @ts-ignore incorrect typescript typings
import * as Mailchimp from "mailchimp-api-v3";

import config from "./config";
import * as logs from "./logs";

const mailchimp = new Mailchimp(config.mailchimpApiKey);

logs.init();

export const addUserToList = functions.handler.auth.user.onCreate(
  async (user): Promise<void> => {
    logs.start();

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
          status: "subscribed",
        }
      );
      logs.userAdded(uid, config.mailchimpAudienceId, results.id);
      logs.complete();
    } catch (err) {
      logs.errorAddUser(err);
    }
  }
);

export const removeUserFromList = functions.handler.auth.user.onDelete(
  async (user): Promise<void> => {
    logs.start();

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

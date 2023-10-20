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
import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";
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

// Initialize the Firebase Admin SDK
admin.initializeApp();

export const addUserToList = functions.auth
  .user()
  .onCreate(async (user): Promise<void> => {
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
      if (/already a list member/.test(err)) {
        logs.userAlreadyInAudience(uid, config.mailchimpAudienceId);
      } else {
        logs.errorAddUser(err);
      }
    }
  });

export const removeUserFromList = functions.auth
  .user()
  .onDelete(async (user): Promise<void> => {
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
      const hashed = crypto.createHash("md5").update(email).digest("hex");

      logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
      await mailchimp.delete(
        `/lists/${config.mailchimpAudienceId}/members/${hashed}`
      );
      logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
      logs.complete();
    } catch (err) {
      logs.errorRemoveUser(err);
    }
  });

export const addExistingUsersToList = functions.tasks
  .taskQueue()
  .onDispatch(async (data) => {
    const runtime = getExtensions().runtime();
    if (!config.doBackfill) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        "No processing requested."
      );
      return;
    }
    const nextPageToken = data.nextPageToken;
    const pastSuccessCount = (data["successCount"] as number) ?? 0;
    const pastErrorCount = (data["errorCount"] as number) ?? 0;

    const res = await getAuth().listUsers(100, nextPageToken);
    const mailchimpPromises = res.users.map(async (user) => {
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
      } catch (err) {
        if (/already a list member/.test(err)) {
          logs.userAlreadyInAudience(uid, config.mailchimpAudienceId);
        } else {
          logs.errorAddUser(err);
          throw err;
        }
      }
    });
    const results = await Promise.allSettled(mailchimpPromises);
    const newSucessCount =
      pastSuccessCount + results.filter((p) => p.status === "fulfilled").length;
    const newErrorCount =
      pastErrorCount + results.filter((p) => p.status === "rejected").length;
    if (res.pageToken) {
      // If there is a pageToken, we have more users to add, so we enqueue another task.
      const queue = getFunctions().taskQueue(
        "addExistingUsersToList",
        process.env.EXT_INSTANCE_ID
      );
      await queue.enqueue({
        nextPageToken: res.pageToken,
        successCount: newSucessCount,
        errorCount: newErrorCount,
      });
    } else {
      // The backfill is complete, now we need to set the processing state.
      logs.backfillComplete(newSucessCount, newErrorCount);
      if (newErrorCount == 0) {
        await runtime.setProcessingState(
          "PROCESSING_COMPLETE",
          `Successfully added ${newSucessCount} users.`
        );
      } else if (newErrorCount > 0 && newSucessCount > 0) {
        await runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Successfully added ${newSucessCount} users, failed to add ${newErrorCount} users.`
        );
      }
      if (newErrorCount > 0 && newSucessCount == 0) {
        await runtime.setProcessingState(
          "PROCESSING_FAILED",
          `Successfully added ${newSucessCount} users, failed to add ${newErrorCount} users.`
        );
      }
    }
  });

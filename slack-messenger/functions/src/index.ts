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

import * as functions from "firebase-functions";
import fetch from "node-fetch";

import config from "./config";
import * as logs from "./logs";

logs.init();

export const slackMessenger = functions.handler.pubsub.topic.onPublish(
  async (message): Promise<void> => {
    logs.start();

    try {
      const { text } = message.json;
      if (!text) {
        console.warn("PubSub message does not contain a `text` field");
        return;
      }

      logs.messageSending(config.slackWebhookUrl);
      await fetch(config.slackWebhookUrl, {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      logs.messageSent(config.slackWebhookUrl);
      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

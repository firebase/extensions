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

const { PubSub } = require("@google-cloud/pubsub");
var _ = require("lodash");

import * as config from "./config";

export async function runBatchPubSubDeletions(paths: string[]) {
  /** Define pubsub */
  const pubsub = new PubSub();

  if (!paths.length) return Promise.resolve();

  /** Define batch array variables */
  for await (const chunk of _.chunk(paths, 450)) {
    const topic = pubsub.topic(
      `projects/${process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.PROJECT_ID}/topics/${config.default.deletionTopic}`
    );
    await topic.publish(Buffer.from(JSON.stringify({ paths: chunk })));
  }
}

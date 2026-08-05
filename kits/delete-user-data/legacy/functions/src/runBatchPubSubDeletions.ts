import chunk from "lodash.chunk";
const { PubSub } = require("@google-cloud/pubsub");

import * as config from "./config";

type Paths = {
  firestorePaths: string[];
};

export async function runBatchPubSubDeletions(paths: Paths, uid: string) {
  /** Define pubsub */
  const pubsub = new PubSub();

  const { firestorePaths } = paths;

  if (!firestorePaths || !Array.isArray(firestorePaths)) {
    return;
  }

  if (firestorePaths.length === 0) {
    return;
  }

  /** Define batch array variables */
  for await (const chunkedPaths of chunk<string>(firestorePaths, 450)) {
    const topic = pubsub.topic(
      `projects/${
        process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID
      }/topics/${config.default.deletionTopic}`
    );
    await topic.publish(
      Buffer.from(JSON.stringify({ paths: chunkedPaths, uid }))
    );
  }
}

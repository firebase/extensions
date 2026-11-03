/**
 * Copyright 2026 Google LLC
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

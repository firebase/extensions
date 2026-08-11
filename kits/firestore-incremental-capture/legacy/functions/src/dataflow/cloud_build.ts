/**
 * Copyright 2023 Google LLC
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

import { logger } from "firebase-functions/v1";
import config from "../config";
import { CloudBuildClient } from "@google-cloud/cloudbuild";

const cloneStep = {
  name: "gcr.io/cloud-builders/git",
  args: [
    "clone",
    "https://github.com/GoogleCloudPlatform/firebase-extensions.git",
  ],
};

const checkoutStep = {
  name: "gcr.io/cloud-builders/git",
  args: ["checkout", "@invertase/firestore-incremental-capture"],
  dir: "firebase-extensions",
};

const buildStep = {
  name: "maven:3.8.1-openjdk-11",
  args: [
    "mvn",
    "compile",
    "exec:java",
    "-Dexec.mainClass=com.pipeline.RestorationPipeline",
    `-Dexec.args=--runner=DataflowRunner --project=${config.projectId} --stagingLocation=${config.stagingLocation} --templateLocation=${config.templateLocation} --region=${config.dataflowRegion}`,
  ],
  dir: "firebase-extensions/firestore-incremental-capture/functions/pipeline",
};

// const notifyStep = {
//   name: 'gcr.io/cloud-builders/curl',
//   entrypoint: 'bash',
//   args: [
//     '-c',
//     `curl -X POST -H "Content-Type: application/json" -d \'{"status": "$BUILD_STATUS", "build_id": "$BUILD_ID"}\' https://${config.instanceId}/onCloudBuildComplete`,
//   ],
// };

const client = new CloudBuildClient();

/**
 * Builds the template for the dataflow pipeline, return the LROperation name
 */
export const stageTemplate = async () => {
  logger.info("Staging template");
  const build_id = `${config.instanceId}-dataflow-template-${Date.now()}`;

  const [operation] = await client.createBuild({
    projectId: config.projectId,
    build: {
      name: build_id,
      id: build_id,
      steps: [cloneStep, checkoutStep, buildStep],
    },
  });

  logger.info(`Build created: ${operation.name}`);

  if (operation.error) {
    throw new Error(operation.error.message);
  }
  return operation;
};

/**
 * Regularly ping the import operation to check for completion
 */
export async function WaitForCreateBuildCompletion(name: string) {
  logger.log("Checking for create build progress: ", name);
  const response = await client.checkCreateBuildProgress(name);
  if (!response.done) {
    // Wait for 1 minute retrying
    await new Promise((resolve) => setTimeout(resolve, 60000));
    /** try again */
    await WaitForCreateBuildCompletion(name);
  }
  return Promise.resolve(response);
}

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

import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v1";
import { FlexTemplatesServiceClient } from "@google-cloud/dataflow";
import { Timestamp } from "firebase-admin/firestore";

import config from "../config";

const dataflowClient = new FlexTemplatesServiceClient();

export async function launchJob(timestamp: number) {
  const projectId = config.projectId;
  const serverTimestamp = Timestamp.now().toMillis();
  const { syncCollectionPath } = config;

  const runId = `${config.instanceId}-dataflow-run-${serverTimestamp}`;

  logger.info(`Launching job ${runId}`, {
    labels: { run_id: runId },
  });

  const runDoc = admin.firestore().doc(`restore/${runId}`);

  // Extract the database name from the backup instance name
  const values = config.backupInstanceName.split("/");
  const firestoreDb = values[values.length - 1];

  /** Select the correct collection Id for apache beam */
  const firestoreCollectionId =
    syncCollectionPath === "{document=**}" ? "*" : syncCollectionPath;

  const [response] = await dataflowClient.launchFlexTemplate({
    projectId,
    location: config.location,
    launchParameter: {
      jobName: runId,
      parameters: {
        timestamp: timestamp.toString(),
        firestoreCollectionId,
        firestoreDb,
        bigQueryDataset: config.bqDataset,
        bigQueryTable: config.bqtable,
      },
      containerSpecGcsPath: `gs://${config.bucketName}/${config.instanceId}-dataflow-restore`,
    },
  });

  await runDoc.set({ status: "export triggered", runId: runId });

  logger.info(`Launched job named ${response.job?.name} successfully`, {
    job_response: response,
    labels: { run_id: runId },
  });

  return response;
}

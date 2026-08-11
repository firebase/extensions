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

// eslint-disable-next-line node/no-unpublished-import
import * as firestore from "@google-cloud/firestore";
import config from "../config";
import { logger } from "firebase-functions/v1";

const client = new firestore.v1.FirestoreAdminClient({
  projectId: config.projectId,
});

/**
 * Regularly ping the export operation to check for completion
 */
export async function waitForExportCompletion(name: string) {
  logger.log("Checking for export progress: ", name);
  const response = await client.checkExportDocumentsProgress(name);
  if (!response.done) {
    // Wait for 1 minute retrying
    await new Promise((resolve) => setTimeout(resolve, 60000));
    //try again
    await waitForExportCompletion(name);
  }
  return Promise.resolve(response);
}

/**
 * Regularly ping the import operation to check for completion
 */
export async function waitForImportCompletion(name: string) {
  logger.log("Checking for import progress: ", name);
  const response = await client.checkImportDocumentsProgress(name);
  if (!response.done) {
    // Wait for 1 minute retrying
    await new Promise((resolve) => setTimeout(resolve, 60000));
    // try again
    await waitForImportCompletion(name);
  }
  return Promise.resolve(response);
}

/**
 * Imports data from GCS to the specified Firestore backup instance
 */
export async function createImport(id: string) {
  const { projectId, syncCollectionPath, bucketName } = config;

  // Extract the database name from the backup instance name
  const values = config.backupInstanceName.split("/");
  const database = values[values.length - 1];

  const name = client.databasePath(projectId, database);

  // Start backup
  const [operation] = await client.importDocuments({
    name,
    inputUriPrefix: `gs://${bucketName}/backups/${id}`,
    collectionIds:
      syncCollectionPath === "**" ? [] : syncCollectionPath.split(","),
  });

  return { id, operation };
}

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
import { Storage } from "@google-cloud/storage";
import * as logs from "./logs";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";

// TODO: we dont need to promisify in node 18+
const writeFile = promisify(fs.writeFile);

// Initialize Google Cloud Storage client
const storage = new Storage();

/**
 * Backs up the event data to Google Cloud Storage as a CSV file.
 *
 * @param bucketName - The name of the GCS bucket.
 * @param dirName - The directory path inside the bucket where the file will be stored.
 * @param event - The event data containing changeType, documentId, serializedData, serializedOldData, context.
 */
export async function backupToGCS(
  bucketName: string,
  dirName: string,
  {
    changeType,
    documentId,
    serializedData,
    serializedOldData,
    context,
  }: {
    changeType: string;
    documentId: string;
    serializedData: any;
    serializedOldData: any;
    context: functions.EventContext;
  }
) {
  // Define the filename using documentId and timestamp to ensure uniqueness
  const fileName = `${dirName}/${documentId}_${context.eventId}.csv`;

  // Create a CSV string from the event data
  const csvData = `
timestamp,event_id,document_name,operation,data,old_data,document_id
"${context.timestamp}","${context.eventId}","${context.resource.name}",
"${changeType}","${JSON.stringify(serializedData)}","${JSON.stringify(
    serializedOldData
  )}","${documentId}"
`.trim();

  try {
    // Write the CSV data to a temporary local file
    const tempFilePath = path.join(
      "/tmp",
      `${documentId}_${context.eventId}.csv`
    );
    await writeFile(tempFilePath, csvData, "utf8");

    // Upload the file to Google Cloud Storage
    await storage.bucket(bucketName).upload(tempFilePath, {
      destination: fileName,
      contentType: "text/csv",
    });

    // Log the successful backup
    functions.logger.info(
      `Successfully backed up event for document ${documentId} to ${fileName}`
    );

    // Remove the temporary file after successful upload
    fs.unlinkSync(tempFilePath);
  } catch (err) {
    // Log any errors that occur during the backup process
    logs.error(
      false,
      `Failed to back up event for document ${documentId}`,
      err
    );
    throw err; // Rethrow the error to be handled by the calling function
  }
}

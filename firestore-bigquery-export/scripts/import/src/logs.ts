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

import { CliConfig } from "./types";

export const finishedImporting = (rowCount: number) => {
  console.log("---------------------------------------------------------");
  console.log(`Finished importing ${rowCount} Firestore rows to BigQuery`);
  console.log("---------------------------------------------------------");
};

export const errorImporting = (error: unknown) => {
  console.error(`Error importing Collection to BigQuery: ${error.toString()}`);
};

export const warningUnlinkingJournalFile = (
  cursorPositionFile: string,
  e: unknown
) => {
  console.warn(e);
  console.warn(
    `Error unlinking journal file ${cursorPositionFile} after successful import: ${e.toString()}`
  );
};

export const importingData = (config: CliConfig) => {
  console.log(
    `Importing data from Cloud Firestore Collection${
      config.queryCollectionGroup ? " (via a Collection Group query)" : ""
    }: ${config.sourceCollectionPath}, to BigQuery Dataset: ${
      config.datasetId
    }, Table: ${config.rawChangeLogName}`
  );
};

export const waitingToInitialize = () => {
  console.log("Wait a few seconds for the dataset to initialize...");
};

export const finishedImportingParallel = (
  config: CliConfig,
  total: number,
  partitions: number
) => {
  console.log(`Imported ${total} documents in ${partitions} partitions.`);

  console.log("---------------------------------------------------------");
  console.log(
    `Please see https://console.cloud.google.com/bigquery?p=${config.bigQueryProjectId}&d=${config.datasetId}&t=${config.tableId}_raw_changelog&page=table`
  );
  console.log("---------------------------------------------------------");
};

export const resumingImport = (config: CliConfig, cursorDocumentId: string) => {
  console.log(
    `Resuming import of Cloud Firestore Collection ${
      config.sourceCollectionPath
    } ${
      config.queryCollectionGroup ? " (via a Collection Group query)" : ""
    } from document ${cursorDocumentId}.`
  );
};

export const warningMultiThreadedCollectionGroupOnly = () => {
  console.warn(
    "Multi-threaded imports are only supported for Collection Group queries. Proceeding with a single thread."
  );
};

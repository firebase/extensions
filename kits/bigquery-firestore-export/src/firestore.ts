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

import type { BigQuery } from "@google-cloud/bigquery";
import type { Firestore } from "firebase-admin/firestore";
import { convertUnsupportedDataTypes } from "./convert";
import { parseTransferRunName } from "./dts";
import type { ResolvedExportConfig } from "./export-config";
import * as logs from "./logs";
import type { BigQueryRow, TransferRunMessage } from "./types";

const CHUNK_SIZE = 10000;

/**
 * Updates the `latest` run document for a transfer config. Runs in a
 * transaction to prevent races between concurrent Pub/Sub deliveries. Updates
 * when: no doc exists, the doc is corrupted/incomplete, the current run is
 * newer, or the same run is redelivered with fresh data.
 *
 * @param db - Firestore instance.
 * @param config - The resolved configuration.
 * @param transferConfigId - The transfer config id.
 * @param runId - The run id.
 * @param message - The transfer run message.
 * @param rowCounts - Explicit zeros for failed runs, actual counts on success.
 */
export async function updateLatestRunDocument(
  db: Firestore,
  config: ResolvedExportConfig,
  transferConfigId: string,
  runId: string,
  message: TransferRunMessage,
  rowCounts: { failedRowCount: number; totalRowCount: number }
): Promise<void> {
  const latestRef = db
    .collection(`${config.firestoreCollection}/${transferConfigId}/runs`)
    .doc("latest");

  const runTime = new Date(message.json.runTime);

  const docUpdate = {
    runMetadata: message.json,
    latestRunId: runId,
    ...rowCounts,
  };

  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(latestRef);
    const latestData = latest.data();
    const existingRunTime = latestData?.runMetadata?.runTime;
    const existingRunId = latestData?.latestRunId;

    const shouldUpdate =
      !latestData ||
      !existingRunTime ||
      new Date(existingRunTime) < runTime ||
      existingRunId === runId;

    if (shouldUpdate) {
      transaction.set(latestRef, docUpdate);
    } else {
      logs.latestDocUpdateSkipped(
        transferConfigId,
        runId,
        `existing run is newer (${existingRunTime} >= ${message.json.runTime})`
      );
    }
  });
}

/**
 * Runs `SELECT *` on the transfer run's destination table.
 *
 * @param bigquery - BigQuery client.
 * @param config - The resolved configuration.
 * @param transferConfigId - The transfer config id (for logging).
 * @param runId - The run id (for logging).
 * @param datasetId - The destination dataset.
 * @param tableName - The materialized destination table name.
 * @returns The result rows.
 */
export async function getBigqueryResults(
  bigquery: BigQuery,
  config: ResolvedExportConfig,
  transferConfigId: string,
  runId: string,
  datasetId: string,
  tableName: string
): Promise<BigQueryRow[]> {
  const query = `SELECT * FROM \`${config.projectId}.${datasetId}.${tableName}\``;
  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: config.bigqueryDatasetLocation,
  };

  try {
    const [job] = await bigquery.createQueryJob(options);
    logs.bigqueryJobStarted(job.id);

    const [rows] = await job.getQueryResults();
    logs.bigqueryResultsRowCount(transferConfigId, runId, rows.length);
    return rows;
  } catch (error) {
    logs.bigqueryQueryFailed(
      transferConfigId,
      runId,
      tableName,
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Queries the run's destination table and writes results to the corresponding
 * Firestore output subcollection, then writes run metadata and updates the
 * `latest` doc.
 *
 * @param db - Firestore instance.
 * @param bigquery - BigQuery client.
 * @param config - The resolved configuration.
 * @param message - The transfer run message.
 */
export async function writeRunResultsToFirestore(
  db: Firestore,
  bigquery: BigQuery,
  config: ResolvedExportConfig,
  message: TransferRunMessage
): Promise<void> {
  const { transferConfigId, runId } = parseTransferRunName(message.json.name);
  const runTime = new Date(message.json.runTime);
  const hourStr = String(runTime.getUTCHours()).padStart(2, "0");
  const minuteStr = String(runTime.getUTCMinutes()).padStart(2, "0");
  const secondStr = String(runTime.getUTCSeconds()).padStart(2, "0");
  // Assumes the exact template '{run_time|"%H%M%S"}' set at creation; if the
  // template drifts, the replacement misses and the query targets a
  // non-existent table.
  const tableName = message.json.params.destination_table_name_template.replace(
    '{run_time|"%H%M%S"}',
    `${hourStr}${minuteStr}${secondStr}`
  );

  const datasetId = message.json.destinationDatasetId;
  const rows = await getBigqueryResults(
    bigquery,
    config,
    transferConfigId,
    runId,
    datasetId,
    tableName
  );
  logs.writeRunResultsToFirestore(runId);
  const collection = db.collection(
    `${config.firestoreCollection}/${transferConfigId}/runs/${runId}/output`
  );

  const rowLength = rows.length;
  let succeededRowCount = 0;

  for (let i = 0; i < rowLength; i += CHUNK_SIZE) {
    const promises = [];

    for (let j = i; j < i + CHUNK_SIZE && j < rowLength; j++) {
      promises.push(collection.add(convertUnsupportedDataTypes(rows[j])));
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        succeededRowCount++;
      } else {
        logs.errorWritingToFirestore(result.reason);
      }
    }
  }

  const failedRowCount = rowLength - succeededRowCount;
  logs.runResultsWrittenToFirestore(runId, succeededRowCount, rows.length);

  const rowCounts = { failedRowCount, totalRowCount: rows.length };

  await db
    .collection(`${config.firestoreCollection}/${transferConfigId}/runs`)
    .doc(runId)
    .set({
      runMetadata: message.json,
      ...rowCounts,
    });

  await updateLatestRunDocument(
    db,
    config,
    transferConfigId,
    runId,
    message,
    rowCounts
  );
}

/**
 * Whether the transfer config doc for `transferConfigId` is tagged with this
 * instance's id.
 *
 * @param db - Firestore instance.
 * @param config - The resolved configuration.
 * @param transferConfigId - The transfer config id.
 * @returns True when the config belongs to this instance.
 */
export async function transferConfigAssociatedWithInstance(
  db: Firestore,
  config: ResolvedExportConfig,
  transferConfigId: string
): Promise<boolean> {
  const q = db
    .collection(config.firestoreCollection)
    .where("extInstanceId", "==", config.instanceId);
  const results = await q.get();

  return results.docs.filter((d) => d.id === transferConfigId).length > 0;
}

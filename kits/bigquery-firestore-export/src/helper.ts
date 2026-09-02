/*
 * Copyright 2025 Google LLC
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

import {
  type BigQuery,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import {
  type DocumentData,
  type DocumentReference,
  type Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import type { ResolvedBigqueryFirestoreExportConfig } from "./export-config";
import * as logs from "./logs";
import type {
  BigQueryRow,
  BigQueryRowValue,
  FirestoreRow,
  FirestoreRowValue,
  TransferRunMessage,
} from "./types";

export interface ParsedTransferRunName {
  projectId: string;
  location: string;
  transferConfigId: string;
  runId: string;
}

export interface ParsedTransferConfigName {
  projectId: string;
  location: string;
  transferConfigId: string;
}

export interface ResultHandlerContext {
  db: Firestore;
  bigquery: BigQuery;
  config: ResolvedBigqueryFirestoreExportConfig;
}

const TRANSFER_RUN_NAME_REGEX =
  /^projects\/([^/]+)\/locations\/([^/]+)\/transferConfigs\/([^/]+)\/runs\/([^/]+)$/;
const TRANSFER_CONFIG_NAME_REGEX =
  /^projects\/([^/]+)\/locations\/([^/]+)\/transferConfigs\/([^/]+)$/;
const FIRESTORE_WRITE_CHUNK_SIZE = 10_000;

export function parseTransferRunName(name: string): ParsedTransferRunName {
  const match = name.match(TRANSFER_RUN_NAME_REGEX);
  if (!match) {
    throw new Error(
      `Invalid transfer run name format: "${name}". Expected format: projects/{projectId}/locations/{location}/transferConfigs/{configId}/runs/{runId}`
    );
  }

  return {
    projectId: match[1],
    location: match[2],
    transferConfigId: match[3],
    runId: match[4],
  };
}

export function parseTransferConfigName(
  name: string
): ParsedTransferConfigName {
  const match = name.match(TRANSFER_CONFIG_NAME_REGEX);
  if (!match) {
    throw new Error(
      `Invalid transfer config name format: "${name}". Expected format: projects/{projectId}/locations/{location}/transferConfigs/{configId}`
    );
  }

  return {
    projectId: match[1],
    location: match[2],
    transferConfigId: match[3],
  };
}

export async function updateLatestRunDocument(
  db: Firestore,
  config: ResolvedBigqueryFirestoreExportConfig,
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
      return;
    }

    logs.latestDocUpdateSkipped(
      transferConfigId,
      runId,
      `existing run is newer (${existingRunTime} >= ${message.json.runTime})`
    );
  });
}

export async function getBigqueryResults(
  bigquery: BigQuery,
  config: ResolvedBigqueryFirestoreExportConfig,
  transferConfigId: string,
  runId: string,
  datasetId: string,
  tableName: string
): Promise<BigQueryRow[]> {
  const query = `SELECT * FROM \`${config.projectId}.${datasetId}.${tableName}\``;

  try {
    const [job] = await bigquery.createQueryJob({
      query,
      location: config.bigqueryDatasetLocation,
    });
    logs.bigqueryJobStarted(job.id);
    const [rows] = await job.getQueryResults();
    logs.bigqueryResultsRowCount(transferConfigId, runId, rows.length);
    return rows as BigQueryRow[];
  } catch (err) {
    logs.bigqueryQueryFailed(transferConfigId, runId, tableName, err);
    throw err;
  }
}

export function convertUnsupportedDataTypes(row: null): null;
export function convertUnsupportedDataTypes(row: string): string;
export function convertUnsupportedDataTypes(row: number): number;
export function convertUnsupportedDataTypes(row: boolean): boolean;
export function convertUnsupportedDataTypes(row: BigQueryRow): FirestoreRow;
export function convertUnsupportedDataTypes(
  row: BigQueryRowValue
): FirestoreRowValue;
export function convertUnsupportedDataTypes(
  row: BigQueryRowValue
): FirestoreRowValue {
  if (row === null || typeof row !== "object") {
    return row as FirestoreRowValue;
  }

  if (
    row instanceof BigQueryTimestamp ||
    row instanceof BigQueryDate ||
    row instanceof BigQueryTime ||
    row instanceof BigQueryDatetime
  ) {
    return Timestamp.fromDate(new Date(row.value));
  }
  if (row instanceof Date) return Timestamp.fromDate(row);
  if (row instanceof Buffer) return new Uint8Array(row);
  if (row instanceof Geography) return row.value;
  if (Array.isArray(row)) {
    return row.map((value) => convertUnsupportedDataTypes(value));
  }

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      convertUnsupportedDataTypes(value),
    ])
  ) as FirestoreRow;
}

export async function writeRunResultsToFirestore(
  ctx: ResultHandlerContext,
  message: TransferRunMessage
): Promise<void> {
  const { db, bigquery, config } = ctx;
  const { transferConfigId, runId } = parseTransferRunName(message.json.name);
  const runTime = new Date(message.json.runTime);
  const runTimeSuffix = [
    runTime.getUTCHours(),
    runTime.getUTCMinutes(),
    runTime.getUTCSeconds(),
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  const tableName = message.json.params.destination_table_name_template.replace(
    '{run_time|"%H%M%S"}',
    runTimeSuffix
  );
  const rows = await getBigqueryResults(
    bigquery,
    config,
    transferConfigId,
    runId,
    message.json.destinationDatasetId,
    tableName
  );
  logs.writeRunResultsToFirestore(runId);
  const collection = db.collection(
    `${config.firestoreCollection}/${transferConfigId}/runs/${runId}/output`
  );
  let succeededRowCount = 0;

  for (let i = 0; i < rows.length; i += FIRESTORE_WRITE_CHUNK_SIZE) {
    const writes: Array<Promise<DocumentReference<DocumentData>>> = [];
    for (
      let j = i;
      j < i + FIRESTORE_WRITE_CHUNK_SIZE && j < rows.length;
      j++
    ) {
      writes.push(collection.add(convertUnsupportedDataTypes(rows[j])));
    }

    const results = await Promise.allSettled(writes);
    for (const result of results) {
      if (result.status === "fulfilled") succeededRowCount++;
      else logs.errorWritingToFirestore(result.reason);
    }
  }

  const rowCounts = {
    failedRowCount: rows.length - succeededRowCount,
    totalRowCount: rows.length,
  };
  logs.runResultsWrittenToFirestore(runId, succeededRowCount, rows.length);

  await db
    .collection(`${config.firestoreCollection}/${transferConfigId}/runs`)
    .doc(runId)
    .set({ runMetadata: message.json, ...rowCounts });
  await updateLatestRunDocument(
    db,
    config,
    transferConfigId,
    runId,
    message,
    rowCounts
  );
}

export async function transferConfigAssociatedWithInstance(
  db: Firestore,
  config: ResolvedBigqueryFirestoreExportConfig,
  transferConfigId: string
): Promise<boolean> {
  const results = await db
    .collection(config.firestoreCollection)
    .where("extInstanceId", "==", config.instanceId)
    .get();
  return results.docs.some((doc) => doc.id === transferConfigId);
}

export async function handleTransferRunMessage(
  ctx: ResultHandlerContext,
  message: TransferRunMessage
): Promise<void> {
  const { transferConfigId, runId } = parseTransferRunName(message.json.name);
  const associated = await transferConfigAssociatedWithInstance(
    ctx.db,
    ctx.config,
    transferConfigId
  );

  if (!associated) {
    throw new Error(
      `Skipping handling pubsub message because transferConfig '${transferConfigId}' is not associated with extension instance '${ctx.config.instanceId}'.`
    );
  }

  if (message.json.state === "SUCCEEDED") {
    await writeRunResultsToFirestore(ctx, message);
    return;
  }

  logs.handlingNonSuccessRun(transferConfigId, runId, message.json.state);
  const rowCounts = { failedRowCount: 0, totalRowCount: 0 };
  await ctx.db
    .collection(`${ctx.config.firestoreCollection}/${transferConfigId}/runs`)
    .doc(runId)
    .set({ runMetadata: message.json, ...rowCounts });
  await updateLatestRunDocument(
    ctx.db,
    ctx.config,
    transferConfigId,
    runId,
    message,
    rowCounts
  );
}

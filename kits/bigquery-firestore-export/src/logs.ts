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

import { logger } from "firebase-functions";
import type { ResolvedBigqueryFirestoreExportConfig } from "./export-config";

export function init(config: ResolvedBigqueryFirestoreExportConfig): void {
  logger.info("Initializing BigQuery Firestore export", {
    ...config,
    queryString: "<omitted>",
  });
}

export function start(): void {
  logger.info("Started BigQuery Firestore export execution");
}

export function complete(): void {
  logger.info("Completed BigQuery Firestore export execution");
}

export function error(err: unknown): void {
  logger.error("Unhandled error during BigQuery Firestore export", err);
}

export function errorWritingToFirestore(err: unknown): void {
  logger.error("Error writing a BigQuery row to Firestore", err);
}

export function bigqueryJobStarted(jobId: string | undefined): void {
  logger.info(`BigQuery job ${jobId ?? "<unknown>"} started`);
}

export function bigqueryResultsRowCount(
  transferConfigId: string,
  runId: string,
  count: number
): void {
  logger.debug("Read BigQuery transfer results", {
    transferConfigId,
    runId,
    count,
  });
}

export function bigqueryQueryFailed(
  transferConfigId: string,
  runId: string,
  tableName: string,
  err: unknown
): void {
  logger.error("BigQuery result query failed", {
    transferConfigId,
    runId,
    tableName,
    err,
  });
}

export function writeRunResultsToFirestore(runId: string): void {
  logger.debug("Writing BigQuery results to Firestore", { runId });
}

export function runResultsWrittenToFirestore(
  runId: string,
  successCount: number,
  totalCount: number
): void {
  logger.info("Finished writing BigQuery results to Firestore", {
    runId,
    successCount,
    totalCount,
  });
}

export function latestDocUpdateSkipped(
  transferConfigId: string,
  runId: string,
  reason: string
): void {
  logger.debug("Skipped updating latest transfer-run document", {
    transferConfigId,
    runId,
    reason,
  });
}

export function handlingNonSuccessRun(
  transferConfigId: string,
  runId: string,
  state: string
): void {
  logger.info("Recording non-successful BigQuery transfer run", {
    transferConfigId,
    runId,
    state,
  });
}

export function createTransferConfig(): void {
  logger.info("Creating BigQuery Data Transfer config");
}

export function transferConfigCreated(name: string): void {
  logger.info("Created BigQuery Data Transfer config", { name });
}

export function updateTransferConfig(name: string): void {
  logger.info("Updating BigQuery Data Transfer config", { name });
}

export function transferConfigUpdated(name: string): void {
  logger.info("Updated BigQuery Data Transfer config", { name });
}

export function transferConfigNotFound(name: string): void {
  logger.error("BigQuery Data Transfer config not found", { name });
}

export function getTransferConfigFailed(name: string, err: unknown): void {
  logger.error("Failed to read BigQuery Data Transfer config", { name, err });
}

export function partitioningFieldRemovalAttempted(
  name: string,
  existingField: string
): void {
  logger.warn("Cannot remove an existing DTS partitioning field", {
    name,
    existingField,
  });
}

export function topicCreated(name: string): void {
  logger.info("Created Pub/Sub topic for transfer notifications", { name });
}

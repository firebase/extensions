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

import { logger } from "firebase-functions";
import type { LogLevel } from "./types";

const LEVEL_ORDER: Record<Exclude<LogLevel, "silent">, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let activeLevel: LogLevel = "info";

/** Sets the minimum level below which log calls become no-ops. */
export function setLogLevel(level: LogLevel): void {
  activeLevel = level;
}

function enabled(level: Exclude<LogLevel, "silent">): boolean {
  if (activeLevel === "silent") {
    return false;
  }
  return LEVEL_ORDER[level] >= LEVEL_ORDER[activeLevel];
}

function debug(...args: unknown[]): void {
  if (enabled("debug")) {
    logger.debug(...args);
  }
}

function info(...args: unknown[]): void {
  if (enabled("info")) {
    logger.info(...args);
  }
}

function warn(...args: unknown[]): void {
  if (enabled("warn")) {
    logger.warn(...args);
  }
}

function logError(...args: unknown[]): void {
  if (enabled("error")) {
    logger.error(...args);
  }
}

export function init(config: unknown) {
  info("Initializing bigquery-firestore-export with configuration", config);
}

export function errorWritingToFirestore(err: unknown) {
  logError("Error writing to Firestore:", err);
}

export function error(err: Error) {
  logError("Unhandled error occurred during processing:", err);
}

export function bigqueryJobStarted(jobId: string | undefined) {
  info(`Job ${jobId} started.`);
}

export function createTransferConfig() {
  debug("Creating a new transfer config.");
}

export function transferConfigCreated(transferConfigName: string) {
  debug(
    `Successfully created a new transfer config with name '${transferConfigName}'.`
  );
}

export function updateTransferConfig(transferConfigName: string) {
  debug(`Updating transfer config '${transferConfigName}'.`);
}

export function transferConfigUpdated(transferConfigName: string) {
  debug(`Successfully updated transfer config '${transferConfigName}'.`);
}

export function writeRunResultsToFirestore(runId: string) {
  debug(`Writing query output from run '${runId}' to Firestore.`);
}

export function runResultsWrittenToFirestore(
  runId: string,
  successCount: number,
  totalCount: number
) {
  debug(
    `Finished writing query output from run '${runId}' to Firestore. ${successCount}/${totalCount} rows written successfully.`
  );
}

export function bigqueryResultsRowCount(
  transferConfigId: string,
  runId: string,
  count: number
) {
  debug(
    `Destination table for transfer config '${transferConfigId}' and transfer run '${runId}' contained rows ${count}.`
  );
}

export function pubsubMessage(payload: unknown) {
  debug(
    `Transfer run complete. Handling pubsub message: ${JSON.stringify(
      payload,
      null,
      2
    )}`
  );
}

export function pubsubMessageHandled(payload: unknown) {
  debug(
    `Pubsub message successfully handled: ${JSON.stringify(payload, null, 2)}`
  );
}

export function partitioningFieldRemovalAttempted(
  transferConfigName: string,
  existingField: string
) {
  warn(
    `Attempted to remove partitioning_field '${existingField}' from transfer config '${transferConfigName}'. This operation is not supported by the BigQuery Data Transfer API.`
  );
}

export function latestDocUpdateSkipped(
  transferConfigId: string,
  runId: string,
  reason: string
) {
  debug(
    `Skipped updating 'latest' doc for transfer config '${transferConfigId}', run '${runId}': ${reason}`
  );
}

export function handlingNonSuccessRun(
  transferConfigId: string,
  runId: string,
  state: string
) {
  debug(
    `Handling non-success run for transfer config '${transferConfigId}', run '${runId}' with state '${state}'.`
  );
}

export function bigqueryQueryFailed(
  transferConfigId: string,
  runId: string,
  tableName: string,
  err: Error
) {
  debug(
    `BigQuery query failed for transfer config '${transferConfigId}', run '${runId}', table '${tableName}': ${err.message}\n${err.stack}`
  );
}

export function transferConfigNotFound(transferConfigName: string) {
  logError(`Transfer config not found: '${transferConfigName}'`);
}

export function getTransferConfigFailed(
  transferConfigName: string,
  err: Error
) {
  debug(
    `Failed to get transfer config '${transferConfigName}': ${err.message}\n${err.stack}`
  );
}

export function topicEnsured(topic: string) {
  debug(`Pub/Sub topic '${topic}' exists or was created.`);
}

export function provisioningFailed(stage: string, err: unknown) {
  logError(
    `Provisioning failed while ${stage}: ${
      err instanceof Error ? err.message : String(err)
    }`
  );
}

export function partitioningRemovalTerminal(message: string) {
  warn(`Provisioning finished with a terminal condition: ${message}`);
}

export function serviceAccountLookupFailed() {
  warn(
    "Could not determine the runtime service account from the metadata server; creating the transfer config without an explicit serviceAccountName."
  );
}

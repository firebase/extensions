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

import type {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import type { Timestamp } from "firebase-admin/firestore";

/** Parameters attached to a BigQuery scheduled-query transfer run. */
export interface TransferRunParams {
  destination_table_name_template: string;
  partitioning_field: string;
  query: string;
  write_disposition: string;
}

/** State of a BigQuery Data Transfer run. */
export type TransferRunState =
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "PENDING"
  | "RUNNING"
  | "TRANSFER_STATE_UNSPECIFIED";

/** JSON payload from a BigQuery Data Transfer Pub/Sub notification. */
export interface TransferRunPayload {
  name: string;
  runTime: string;
  state: TransferRunState;
  destinationDatasetId: string;
  dataSourceId: string;
  schedule: string;
  scheduleTime: string;
  startTime: string;
  endTime: string;
  updateTime: string;
  userId: string;
  notificationPubsubTopic: string;
  params: TransferRunParams;
  emailPreferences: Record<string, unknown>;
  errorStatus: Record<string, unknown>;
}

/** Message-shaped wrapper retained for the core handler boundary. */
export interface TransferRunMessage {
  json: TransferRunPayload;
}

/** Values returned in a BigQuery row before conversion. */
export type BigQueryRowValue =
  | string
  | number
  | boolean
  | null
  | Date
  | Buffer
  | BigQueryTimestamp
  | BigQueryDate
  | BigQueryTime
  | BigQueryDatetime
  | Geography
  | BigQueryRow
  | BigQueryRowValue[];

export interface BigQueryRow {
  [key: string]: BigQueryRowValue;
}

/** Firestore-compatible equivalent of a BigQuery row value. */
export type FirestoreRowValue =
  | string
  | number
  | boolean
  | null
  | Timestamp
  | Uint8Array
  | FirestoreRow
  | FirestoreRowValue[];

export interface FirestoreRow {
  [key: string]: FirestoreRowValue;
}

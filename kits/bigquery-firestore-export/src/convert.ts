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

import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import { Timestamp } from "firebase-admin/firestore";
import type { BigQueryRow, FirestoreRow } from "./types";

function shouldConvertToTimestamp(
  value: unknown
): value is BigQueryTimestamp | BigQueryDate | BigQueryTime | BigQueryDatetime {
  return (
    value instanceof BigQueryTimestamp ||
    value instanceof BigQueryDate ||
    value instanceof BigQueryTime ||
    value instanceof BigQueryDatetime
  );
}

/**
 * Converts BigQuery data types to Firestore-compatible types.
 *
 * @param row - Object containing data to convert.
 * @returns Object with converted values.
 */
export function convertUnsupportedDataTypes(row: null): null;
export function convertUnsupportedDataTypes(row: string): string;
export function convertUnsupportedDataTypes(row: number): number;
export function convertUnsupportedDataTypes(row: boolean): boolean;
export function convertUnsupportedDataTypes(row: BigQueryRow): FirestoreRow;
export function convertUnsupportedDataTypes(
  row: BigQueryRow | null | string | number | boolean
): FirestoreRow | null | string | number | boolean {
  if (row === null || typeof row !== "object") {
    return row as string | number | boolean | null;
  }

  const result = { ...row } as FirestoreRow;

  for (const [key, value] of Object.entries(row)) {
    if (value === null || typeof value !== "object") continue;

    if (shouldConvertToTimestamp(value)) {
      result[key] = Timestamp.fromDate(new Date(value.value));
    } else if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (value instanceof Buffer) {
      result[key] = new Uint8Array(value);
    } else if (value instanceof Geography) {
      result[key] = value.value;
    } else if (typeof value === "object") {
      result[key] = convertUnsupportedDataTypes(value as BigQueryRow);
    }
  }

  return result;
}

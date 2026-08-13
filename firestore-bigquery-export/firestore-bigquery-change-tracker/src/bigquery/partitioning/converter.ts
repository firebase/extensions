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

import * as firebase from "firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";

export class PartitionValueConverter {
  constructor(private fieldType: "TIMESTAMP" | "DATE" | "DATETIME") {}

  private isTimestampLike(
    value: any
  ): value is { _seconds: number; _nanoseconds: number } {
    return (
      value !== null &&
      typeof value === "object" &&
      typeof value._seconds === "number" &&
      typeof value._nanoseconds === "number"
    );
  }

  convert(value: unknown): string | null {
    let date: Date;

    if (value instanceof firebase.firestore.Timestamp) {
      date = value.toDate();
    } else if (this.isTimestampLike(value)) {
      date = new firebase.firestore.Timestamp(
        value._seconds,
        value._nanoseconds
      ).toDate();
    } else if (value instanceof Date && !isNaN(value.getTime())) {
      date = value;
    } else if (typeof value === "string") {
      // Strict ISO 8601 / RFC 3339: YYYY-MM-DD, optionally followed by T or
      // space-separated HH:MM[:SS[.ffffff]] and a required timezone designator
      // when the time component is present. JS Date parsing alone is too
      // permissive — it silently normalizes invalid inputs (e.g. "2024-02-30"
      // → "2024-03-01"), accepts partial dates ("2024-01"), and reads bare
      // numerics as years ("1" → "2001-01-01"). Reject all of those.
      const m = value.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/
      );
      if (!m) {
        return null;
      }
      const yearN = Number(m[1]);
      const monthN = Number(m[2]);
      const dayN = Number(m[3]);
      // BigQuery DATE / DATETIME / TIMESTAMP all reject year 0 — the supported
      // range is 0001-01-01 to 9999-12-31. Reject client-side so the row gets
      // a clear warning instead of a server-side insert error.
      if (yearN < 1) {
        return null;
      }
      // Reject calendar-invalid components (Feb 30, non-leap Feb 29, etc.).
      // setUTCFullYear avoids the legacy 2-digit-year quirk of Date.UTC().
      const validator = new Date(0);
      validator.setUTCFullYear(yearN, monthN - 1, dayN);
      if (
        validator.getUTCFullYear() !== yearN ||
        validator.getUTCMonth() + 1 !== monthN ||
        validator.getUTCDate() !== dayN
      ) {
        return null;
      }
      // Reject hour 24 (ISO 8601 allows it as end-of-day, but JS Date and the
      // pre-0.3.0 string passthrough both treat it differently: JS rolls to
      // next day, BigQuery DATETIME rejects the row outright. Rather than
      // silently misfile the row into the next-day partition, reject here so
      // the caller logs firestoreTimePartitionFieldError and the row lands in
      // __NULL__. Minute and second out-of-range values are caught by
      // new Date() returning Invalid Date below.
      if (m[4] !== undefined && Number(m[4]) > 23) {
        return null;
      }
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        return null;
      }
      date = parsed;
    } else {
      return null;
    }

    try {
      switch (this.fieldType) {
        case "DATETIME":
          return BigQuery.datetime(date.toISOString()).value;
        case "DATE":
          return BigQuery.date(date.toISOString().substring(0, 10)).value;
        case "TIMESTAMP":
          return BigQuery.timestamp(date).value;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}

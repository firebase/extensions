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
import { describe, expect, test } from "vitest";
import { convertUnsupportedDataTypes } from "../src/convert";
import type { FirestoreRow } from "../src/types";

describe("convertUnsupportedDataTypes", () => {
  test("returns null for null input", () => {
    expect(convertUnsupportedDataTypes(null)).toBeNull();
  });

  test("returns primitives unchanged", () => {
    expect(convertUnsupportedDataTypes("a")).toBe("a");
    expect(convertUnsupportedDataTypes(42)).toBe(42);
    expect(convertUnsupportedDataTypes(true)).toBe(true);
  });

  test("converts BigQueryTimestamp to Firestore Timestamp", () => {
    const row = { ts: new BigQueryTimestamp("2026-08-01T12:00:00Z") };
    const result = convertUnsupportedDataTypes(row);
    expect(result.ts).toBeInstanceOf(Timestamp);
    expect((result.ts as Timestamp).toDate().toISOString()).toBe(
      "2026-08-01T12:00:00.000Z"
    );
  });

  test("converts BigQueryDate to Firestore Timestamp", () => {
    const result = convertUnsupportedDataTypes({
      d: new BigQueryDate("2026-08-01"),
    });
    expect(result.d).toBeInstanceOf(Timestamp);
  });

  test("converts BigQueryDatetime to Firestore Timestamp", () => {
    const result = convertUnsupportedDataTypes({
      dt: new BigQueryDatetime("2026-08-01 12:00:00"),
    });
    expect(result.dt).toBeInstanceOf(Timestamp);
  });

  test("converts BigQueryTime to Firestore Timestamp", () => {
    // BigQueryTime holds time-of-day only; a bare "HH:MM:SS" value is not
    // Date-parseable, so mirror upstream and use a full datetime string.
    const result = convertUnsupportedDataTypes({
      t: new BigQueryTime("1970-01-01T10:30:00Z"),
    });
    expect(result.t).toBeInstanceOf(Timestamp);
  });

  test("converts Date to Firestore Timestamp", () => {
    const date = new Date("2026-08-01T12:00:00Z");
    const result = convertUnsupportedDataTypes({ d: date });
    expect(result.d).toBeInstanceOf(Timestamp);
    expect((result.d as Timestamp).toDate().getTime()).toBe(date.getTime());
  });

  test("converts Buffer to Uint8Array", () => {
    const result = convertUnsupportedDataTypes({ b: Buffer.from([1, 2, 3]) });
    expect(result.b).toBeInstanceOf(Uint8Array);
    expect([...(result.b as Uint8Array)]).toEqual([1, 2, 3]);
  });

  test("converts Geography to its string value", () => {
    const result = convertUnsupportedDataTypes({
      g: new Geography("POINT(1 2)"),
    });
    expect(result.g).toBe("POINT(1 2)");
  });

  test("handles nested objects recursively", () => {
    const result = convertUnsupportedDataTypes({
      nested: { ts: new BigQueryTimestamp("2026-08-01T12:00:00Z"), n: 1 },
    });
    const nested = result.nested as FirestoreRow;
    expect(nested.ts).toBeInstanceOf(Timestamp);
    expect(nested.n).toBe(1);
  });

  test("handles arrays with objects containing BigQuery types", () => {
    const result = convertUnsupportedDataTypes({
      arr: [{ ts: new BigQueryTimestamp("2026-08-01T12:00:00Z") }],
    });
    const first = (result.arr as FirestoreRow[])[0];
    expect(first.ts).toBeInstanceOf(Timestamp);
  });

  test("preserves null values in objects", () => {
    const result = convertUnsupportedDataTypes({ a: null, b: "x" });
    expect(result.a).toBeNull();
    expect(result.b).toBe("x");
  });

  test("handles mixed data types in a single object", () => {
    const result = convertUnsupportedDataTypes({
      s: "str",
      n: 5,
      bool: false,
      ts: new BigQueryTimestamp("2026-08-01T12:00:00Z"),
      buf: Buffer.from([9]),
      nil: null,
    });
    expect(result.s).toBe("str");
    expect(result.n).toBe(5);
    expect(result.bool).toBe(false);
    expect(result.ts).toBeInstanceOf(Timestamp);
    expect(result.buf).toBeInstanceOf(Uint8Array);
    expect(result.nil).toBeNull();
  });
});

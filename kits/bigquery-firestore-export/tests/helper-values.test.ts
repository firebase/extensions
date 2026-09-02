/*
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

import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
} from "@google-cloud/bigquery";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";
import {
  convertUnsupportedDataTypes,
  parseTransferConfigName,
  parseTransferRunName,
} from "../src/helper";
import type { FirestoreRow } from "../src/types";

describe("parseTransferRunName", () => {
  test("parses ids containing hyphens", () => {
    expect(
      parseTransferRunName(
        "projects/project-123/locations/us-central1/transferConfigs/642f3a36-0000-2fbb-ad1d-001a114e2fa6/runs/648762e0-0000-28ef-9109-001a11446b2a"
      )
    ).toEqual({
      projectId: "project-123",
      location: "us-central1",
      transferConfigId: "642f3a36-0000-2fbb-ad1d-001a114e2fa6",
      runId: "648762e0-0000-28ef-9109-001a11446b2a",
    });
  });

  test("rejects a name without a runs segment", () => {
    expect(() =>
      parseTransferRunName("projects/p/locations/l/transferConfigs/c")
    ).toThrow("Invalid transfer run name format");
  });

  test("rejects an empty name", () => {
    expect(() => parseTransferRunName("")).toThrow(
      "Invalid transfer run name format"
    );
  });
});

describe("parseTransferConfigName", () => {
  test("parses ids containing hyphens", () => {
    expect(
      parseTransferConfigName(
        "projects/project-123/locations/us-central1/transferConfigs/642f3a36-0000-2fbb-ad1d-001a114e2fa6"
      )
    ).toEqual({
      projectId: "project-123",
      location: "us-central1",
      transferConfigId: "642f3a36-0000-2fbb-ad1d-001a114e2fa6",
    });
  });

  test("rejects a transfer run name", () => {
    expect(() =>
      parseTransferConfigName("projects/p/locations/l/transferConfigs/c/runs/r")
    ).toThrow("Invalid transfer config name format");
  });

  test("rejects an empty name", () => {
    expect(() => parseTransferConfigName("")).toThrow(
      "Invalid transfer config name format"
    );
  });
});

describe("convertUnsupportedDataTypes", () => {
  test("returns null and primitives unchanged", () => {
    expect(convertUnsupportedDataTypes(null)).toBeNull();
    expect(convertUnsupportedDataTypes("string")).toBe("string");
    expect(convertUnsupportedDataTypes(123)).toBe(123);
    expect(convertUnsupportedDataTypes(true)).toBe(true);
  });

  test("converts timestamp, date, and datetime values to Firestore Timestamps", () => {
    const converted = convertUnsupportedDataTypes({
      timestamp: new BigQueryTimestamp("2023-01-15T10:30:00Z"),
      date: new BigQueryDate("2023-01-15"),
      datetime: new BigQueryDatetime("2023-01-15T10:30:00"),
    });

    expect((converted.timestamp as Timestamp).toDate().toISOString()).toBe(
      "2023-01-15T10:30:00.000Z"
    );
    expect((converted.date as Timestamp).toDate().toISOString()).toBe(
      "2023-01-15T00:00:00.000Z"
    );
    // A DATETIME carries no offset, so the conversion reads it in the
    // machine's zone rather than UTC.
    expect(converted.datetime).toEqual(
      Timestamp.fromDate(new Date("2023-01-15T10:30:00"))
    );
  });

  test("throws on a TIME value, which no Date can represent", () => {
    expect(() =>
      convertUnsupportedDataTypes({ time: new BigQueryTime("10:30:00") })
    ).toThrow('Value for argument "seconds" is not a valid integer.');
  });

  test("converts a plain Date to a Firestore Timestamp", () => {
    const converted = convertUnsupportedDataTypes({
      date: new Date("2023-01-15T10:30:00Z"),
    });

    expect((converted.date as Timestamp).toDate().toISOString()).toBe(
      "2023-01-15T10:30:00.000Z"
    );
  });

  test("converts a Buffer to a Uint8Array of the same bytes", () => {
    const converted = convertUnsupportedDataTypes({
      data: Buffer.from([1, 2, 3, 4]),
    });

    expect(converted.data).toBeInstanceOf(Uint8Array);
    // Buffer extends Uint8Array, so only this pins the conversion.
    expect(converted.data).not.toBeInstanceOf(Buffer);
    expect(Array.from(converted.data as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  test("descends into nested objects and arrays", () => {
    const converted = convertUnsupportedDataTypes({
      outer: {
        inner: { timestamp: new BigQueryTimestamp("2023-01-15T10:30:00Z") },
      },
      items: [
        { timestamp: new BigQueryTimestamp("2023-01-15T10:30:00Z") },
        { value: "plain" },
      ],
    });

    const inner = (converted.outer as FirestoreRow).inner as FirestoreRow;
    const items = converted.items as FirestoreRow[];
    expect(inner.timestamp).toBeInstanceOf(Timestamp);
    expect(items[0].timestamp).toBeInstanceOf(Timestamp);
    expect(items[1].value).toBe("plain");
  });

  test("preserves null values at every depth", () => {
    const converted = convertUnsupportedDataTypes({
      name: "test",
      nullField: null,
      nested: { alsoNull: null },
    });

    expect(converted.nullField).toBeNull();
    expect((converted.nested as FirestoreRow).alsoNull).toBeNull();
  });
});

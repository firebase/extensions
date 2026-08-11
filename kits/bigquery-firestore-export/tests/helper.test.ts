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

import { Geography } from "@google-cloud/bigquery";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";
import {
  convertUnsupportedDataTypes,
  parseTransferConfigName,
  parseTransferRunName,
} from "../src/helper";

describe("transfer resource parsing", () => {
  test("parses config and run resource names", () => {
    expect(
      parseTransferConfigName(
        "projects/test-project/locations/us/transferConfigs/config-1"
      )
    ).toEqual({
      projectId: "test-project",
      location: "us",
      transferConfigId: "config-1",
    });
    expect(
      parseTransferRunName(
        "projects/test-project/locations/us/transferConfigs/config-1/runs/run-2"
      )
    ).toEqual({
      projectId: "test-project",
      location: "us",
      transferConfigId: "config-1",
      runId: "run-2",
    });
  });

  test("rejects malformed resource names", () => {
    expect(() => parseTransferConfigName("transferConfigs/config-1")).toThrow(
      "Invalid transfer config name format"
    );
    expect(() => parseTransferRunName("runs/run-2")).toThrow(
      "Invalid transfer run name format"
    );
  });
});

describe("convertUnsupportedDataTypes", () => {
  test("recursively converts BigQuery-only values", () => {
    const date = new Date("2026-08-11T12:00:00.000Z");
    const converted = convertUnsupportedDataTypes({
      date,
      bytes: Buffer.from([1, 2, 3]),
      geography: new Geography("POINT(1 2)"),
      nested: [{ value: true }],
    });

    expect(converted.date).toBeInstanceOf(Timestamp);
    expect(converted.bytes).toBeInstanceOf(Uint8Array);
    expect(converted.geography).toBe("POINT(1 2)");
    expect(converted.nested).toEqual([{ value: true }]);
  });
});

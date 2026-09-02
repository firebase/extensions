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

import { type BigQuery, Geography } from "@google-cloud/bigquery";
import { type Firestore, Timestamp } from "firebase-admin/firestore";
import { describe, expect, test, vi } from "vitest";
import { resolveConfig } from "../src/export-config";
import {
  convertUnsupportedDataTypes,
  parseTransferConfigName,
  parseTransferRunName,
  type ResultHandlerContext,
  writeRunResultsToFirestore,
} from "../src/helper";
import * as logs from "../src/logs";
import type { TransferRunMessage } from "../src/types";

vi.mock("../src/logs", { spy: true });

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

describe("writeRunResultsToFirestore", () => {
  test("logs the run id after reading results and before writing rows", async () => {
    const add = vi.fn().mockResolvedValue({});
    const set = vi.fn().mockResolvedValue({});
    const db = {
      collection: vi.fn(() => ({ add, doc: vi.fn(() => ({ set })) })),
      runTransaction: vi.fn(
        async (fn: (transaction: unknown) => Promise<void>) =>
          fn({
            get: vi.fn().mockResolvedValue({ data: () => undefined }),
            set: vi.fn(),
          })
      ),
    } as unknown as Firestore;
    const getQueryResults = vi.fn().mockResolvedValue([[{ value: 1 }]]);
    const bigquery = {
      createQueryJob: vi
        .fn()
        .mockResolvedValue([{ id: "job-1", getQueryResults }]),
    } as unknown as BigQuery;
    const config = resolveConfig({
      bigqueryDatasetLocation: "US",
      projectId: "test-project",
      instanceId: "users-export",
      datasetId: "analytics",
      tableName: "out",
      queryString: "SELECT * FROM source.users",
      displayName: "Users export",
      schedule: "every 24 hours",
    });
    const message = {
      json: {
        name: "projects/test-project/locations/us/transferConfigs/config-1/runs/run-1",
        runTime: "2026-08-20T10:05:39Z",
        state: "SUCCEEDED",
        destinationDatasetId: "analytics",
        params: { destination_table_name_template: 'out_{run_time|"%H%M%S"}' },
      },
    } as TransferRunMessage;
    const ctx = { db, bigquery, config } as ResultHandlerContext;

    await writeRunResultsToFirestore(ctx, message);

    const logSpy = vi.mocked(logs.writeRunResultsToFirestore);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("run-1");
    expect(logSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      getQueryResults.mock.invocationCallOrder[0]
    );
    expect(logSpy.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0]
    );
  });
});

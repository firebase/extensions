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

import type { BigQuery } from "@google-cloud/bigquery";
import { Geography } from "@google-cloud/bigquery";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, test, vi } from "vitest";
import { resolveConfig } from "../src/export-config";
import {
  convertUnsupportedDataTypes,
  parseTransferConfigName,
  parseTransferRunName,
  writeRunResultsToFirestore,
} from "../src/helper";
import type { BigQueryRow, TransferRunMessage } from "../src/types";

vi.mock("../src/logs", () => ({
  bigqueryJobStarted: vi.fn(),
  bigqueryQueryFailed: vi.fn(),
  bigqueryResultsRowCount: vi.fn(),
  errorWritingToFirestore: vi.fn(),
  handlingNonSuccessRun: vi.fn(),
  latestDocUpdateSkipped: vi.fn(),
  runResultsWrittenToFirestore: vi.fn(),
}));

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

const CONFIG = resolveConfig({
  bigqueryDatasetLocation: "US",
  projectId: "test-project",
  instanceId: "users-export",
  datasetId: "analytics",
  tableName: "out",
  queryString: "SELECT * FROM source.users",
  displayName: "Users export",
  schedule: "every 24 hours",
  firestoreCollection: "transferConfigs",
});
const RUN_ID = "run-1";
const RUNS_PATH = "transferConfigs/config-1/runs";
const OUTPUT_PATH = `${RUNS_PATH}/${RUN_ID}/output`;
const MESSAGE = {
  json: {
    name: `projects/test-project/locations/us/transferConfigs/config-1/runs/${RUN_ID}`,
    runTime: "2026-08-20T10:05:39Z",
    state: "SUCCEEDED",
    destinationDatasetId: "analytics",
    params: { destination_table_name_template: 'out_{run_time|"%H%M%S"}' },
  },
} as unknown as TransferRunMessage;

/** Minimal Firestore double keyed by collection path and document id. */
function makeDb(rejectDocIds: string[] = []) {
  const collections = new Map<string, Map<string, unknown>>();
  const rejected = new Set(rejectDocIds);

  const docsFor = (path: string) => {
    const existing = collections.get(path);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    collections.set(path, created);
    return created;
  };
  const docRef = (path: string, id: string) => ({
    set(data: unknown) {
      if (rejected.has(id)) {
        return Promise.reject(new Error(`write refused for ${id}`));
      }
      docsFor(path).set(id, data);
      return Promise.resolve();
    },
    read: () => docsFor(path).get(id),
  });
  const db = {
    collection: (path: string) => ({ doc: (id: string) => docRef(path, id) }),
    runTransaction: (
      fn: (tx: {
        get: (
          ref: ReturnType<typeof docRef>
        ) => Promise<{ data: () => unknown }>;
        set: (ref: ReturnType<typeof docRef>, data: unknown) => void;
      }) => Promise<void>
    ) =>
      fn({
        get: (ref) => Promise.resolve({ data: () => ref.read() }),
        set: (ref, data) => void ref.set(data),
      }),
  } as unknown as Firestore;

  return {
    db,
    docs: (path: string) => docsFor(path),
    output: () => docsFor(OUTPUT_PATH),
  };
}

function makeBigquery(rows: BigQueryRow[]) {
  return {
    createQueryJob: () =>
      Promise.resolve([
        { id: "job-1", getQueryResults: () => Promise.resolve([rows]) },
      ]),
  } as unknown as BigQuery;
}

function rows(count: number): BigQueryRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index,
    label: `row-${index}`,
  }));
}

describe("writeRunResultsToFirestore", () => {
  test("keys each output document by its zero-padded row index", async () => {
    const { db, output } = makeDb();

    await writeRunResultsToFirestore(
      { db, bigquery: makeBigquery(rows(3)), config: CONFIG },
      MESSAGE
    );

    expect([...output().keys()]).toEqual([
      "000000000000",
      "000000000001",
      "000000000002",
    ]);
    expect(output().get("000000000001")).toEqual({ id: 1, label: "row-1" });
  });

  test("a redelivered run overwrites its output instead of appending", async () => {
    const { db, output } = makeDb();
    const ctx = { db, bigquery: makeBigquery(rows(50)), config: CONFIG };

    await writeRunResultsToFirestore(ctx, MESSAGE);
    const firstPass = [...output().keys()];
    await writeRunResultsToFirestore(ctx, MESSAGE);

    expect(output().size).toBe(50);
    expect([...output().keys()]).toEqual(firstPass);
  });

  test("continues past a chunk boundary without restarting ids", async () => {
    const { db, output } = makeDb();

    await writeRunResultsToFirestore(
      { db, bigquery: makeBigquery(rows(10_001)), config: CONFIG },
      MESSAGE
    );

    expect(output().size).toBe(10_001);
    expect(output().has("000000010000")).toBe(true);
  });

  test("counts a rejected row without dropping the others", async () => {
    const { db, docs, output } = makeDb(["000000000001"]);

    await writeRunResultsToFirestore(
      { db, bigquery: makeBigquery(rows(3)), config: CONFIG },
      MESSAGE
    );

    expect([...output().keys()]).toEqual(["000000000000", "000000000002"]);
    expect(docs(RUNS_PATH).get(RUN_ID)).toMatchObject({
      failedRowCount: 1,
      totalRowCount: 3,
    });
  });
});

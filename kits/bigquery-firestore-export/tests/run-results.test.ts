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
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveConfig } from "../src/export-config";
import type { BigQueryRow, TransferRunMessage } from "../src/types";

const mocks = vi.hoisted(() => ({
  errorWritingToFirestore: vi.fn(),
  latestDocUpdateSkipped: vi.fn(),
  handlingNonSuccessRun: vi.fn(),
}));

vi.mock("../src/logs", () => ({
  bigqueryJobStarted: vi.fn(),
  bigqueryQueryFailed: vi.fn(),
  bigqueryResultsRowCount: vi.fn(),
  errorWritingToFirestore: mocks.errorWritingToFirestore,
  handlingNonSuccessRun: mocks.handlingNonSuccessRun,
  latestDocUpdateSkipped: mocks.latestDocUpdateSkipped,
  runResultsWrittenToFirestore: vi.fn(),
}));

import {
  handleTransferRunMessage,
  type ResultHandlerContext,
  writeRunResultsToFirestore,
} from "../src/helper";

type Data = Record<string, unknown>;

const config = resolveConfig({
  bigqueryDatasetLocation: "US",
  projectId: "test-project",
  instanceId: "users-export",
  datasetId: "analytics",
  tableName: "users",
  queryString: "SELECT * FROM source.users",
  displayName: "Users export",
  schedule: "every 24 hours",
});

const TRANSFER_CONFIG_ID = "642f3a36-0000-2fbb-ad1d-001a114e2fa6";
const RUN_ID = "648762e0-0000-28ef-9109-001a11446b2a";

function runName(runId = RUN_ID): string {
  return `projects/test-project/locations/us/transferConfigs/${TRANSFER_CONFIG_ID}/runs/${runId}`;
}

function message(
  overrides: Partial<TransferRunMessage["json"]> = {}
): TransferRunMessage {
  return {
    json: {
      name: runName(),
      runTime: "2023-03-23T21:03:00Z",
      state: "SUCCEEDED",
      destinationDatasetId: "test",
      dataSourceId: "scheduled_query",
      schedule: "every 15 minutes",
      scheduleTime: "2023-03-23T21:03:00Z",
      startTime: "2023-03-23T21:03:01.133872Z",
      endTime: "2023-03-23T21:04:16.167236Z",
      updateTime: "2023-03-23T21:04:16.167248Z",
      userId: "-1291228896441774269",
      notificationPubsubTopic: "projects/test-project/topics/transfer_runs",
      params: {
        destination_table_name_template: 'users_{run_time|"%H%M%S"}',
        partitioning_field: "",
        query: "SELECT * FROM source.users",
        write_disposition: "WRITE_TRUNCATE",
      },
      emailPreferences: {},
      errorStatus: {},
      ...overrides,
    },
  };
}

/**
 * Minimal in-memory stand-in for the Firestore surface the helpers touch:
 * path-addressed documents, auto-id adds, a single equality query and a
 * transaction that runs its body against the same store.
 */
class FakeFirestore {
  readonly docs = new Map<string, Data>();
  private nextAutoId = 0;
  /** Fails an `add` whose row index matches, to exercise partial write failures. */
  rejectAddAt: number | null = null;
  private addCount = 0;

  collection(path: string) {
    return {
      doc: (id: string) => this.docRef(`${path}/${id}`),
      add: async (data: Data) => {
        const index = this.addCount++;
        if (index === this.rejectAddAt) {
          throw new Error(`write failed for row ${index}`);
        }
        const ref = this.docRef(`${path}/auto-${this.nextAutoId++}`);
        this.docs.set(ref.path, data);
        return ref;
      },
      where: (field: string, _op: string, value: unknown) => {
        const query = {
          limit: () => query,
          get: async () => {
            const docs = [...this.docs.entries()]
              .filter(([docPath]) => parentPath(docPath) === path)
              .filter(([, data]) => data[field] === value)
              .map(([docPath, data]) => ({
                id: docPath.split("/").at(-1),
                data: () => data,
              }));
            return { empty: docs.length === 0, docs };
          },
        };
        return query;
      },
    };
  }

  async runTransaction<T>(
    body: (transaction: {
      get: (ref: { path: string }) => Promise<{ data: () => Data | undefined }>;
      set: (ref: { path: string }, data: Data) => void;
    }) => Promise<T>
  ): Promise<T> {
    return body({
      get: async (ref) => ({ data: () => this.docs.get(ref.path) }),
      set: (ref, data) => {
        this.docs.set(ref.path, data);
      },
    });
  }

  private docRef(path: string) {
    return {
      path,
      id: path.split("/").at(-1),
      set: async (data: Data) => {
        this.docs.set(path, data);
      },
    };
  }
}

function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function fakeBigquery(rows: BigQueryRow[]) {
  const createQueryJob = vi.fn().mockResolvedValue([
    {
      id: "job-1",
      getQueryResults: vi.fn().mockResolvedValue([rows]),
    },
  ]);
  return { createQueryJob } as unknown as BigQuery & {
    createQueryJob: ReturnType<typeof vi.fn>;
  };
}

function makeContext(rows: BigQueryRow[] = [{ query: "result" }]) {
  const db = new FakeFirestore();
  const bigquery = fakeBigquery(rows);
  return {
    db,
    bigquery,
    ctx: { db, bigquery, config } as unknown as ResultHandlerContext,
  };
}

function associate(db: FakeFirestore): void {
  db.docs.set(`${config.firestoreCollection}/${TRANSFER_CONFIG_ID}`, {
    extInstanceId: config.instanceId,
  });
}

function runsPath(): string {
  return `${config.firestoreCollection}/${TRANSFER_CONFIG_ID}/runs`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writeRunResultsToFirestore", () => {
  test("queries the run's destination table and writes every row", async () => {
    const rows = [{ query: "result" }, { query: "second" }];
    const { db, bigquery, ctx } = makeContext(rows);

    await writeRunResultsToFirestore(ctx, message());

    expect(bigquery.createQueryJob).toHaveBeenCalledWith({
      query: "SELECT * FROM `test-project.test.users_210300`",
      location: "US",
    });
    const outputPath = `${runsPath()}/${RUN_ID}/output`;
    const written = [...db.docs.entries()]
      .filter(([path]) => parentPath(path) === outputPath)
      .map(([, data]) => data);
    expect(written).toEqual(rows);
  });

  test("records the run and latest documents with row counts", async () => {
    const { db, ctx } = makeContext();
    const msg = message();

    await writeRunResultsToFirestore(ctx, msg);

    expect(db.docs.get(`${runsPath()}/${RUN_ID}`)).toEqual({
      runMetadata: msg.json,
      failedRowCount: 0,
      totalRowCount: 1,
    });
    expect(db.docs.get(`${runsPath()}/latest`)).toEqual({
      runMetadata: msg.json,
      latestRunId: RUN_ID,
      failedRowCount: 0,
      totalRowCount: 1,
    });
  });

  test("counts and logs rows that fail to write", async () => {
    const { db, ctx } = makeContext([
      { query: "first" },
      { query: "second" },
      { query: "third" },
    ]);
    db.rejectAddAt = 1;

    await writeRunResultsToFirestore(ctx, message());

    expect(mocks.errorWritingToFirestore).toHaveBeenCalledOnce();
    expect(db.docs.get(`${runsPath()}/${RUN_ID}`)).toMatchObject({
      failedRowCount: 1,
      totalRowCount: 3,
    });
    expect(db.docs.get(`${runsPath()}/latest`)).toMatchObject({
      failedRowCount: 1,
      totalRowCount: 3,
    });
  });
});

describe("handleTransferRunMessage", () => {
  test("rejects a run belonging to another extension instance", async () => {
    const { ctx } = makeContext();

    await expect(handleTransferRunMessage(ctx, message())).rejects.toThrow(
      `Skipping handling pubsub message because transferConfig '${TRANSFER_CONFIG_ID}' is not associated with extension instance '${config.instanceId}'.`
    );
  });

  test("records a non-successful run with explicit zero counts", async () => {
    const { db, ctx } = makeContext();
    associate(db);
    const failed = message({
      state: "FAILED",
      errorStatus: { message: "Query failed" },
    });

    await handleTransferRunMessage(ctx, failed);

    expect(mocks.handlingNonSuccessRun).toHaveBeenCalledWith(
      TRANSFER_CONFIG_ID,
      RUN_ID,
      "FAILED"
    );
    expect(db.docs.get(`${runsPath()}/${RUN_ID}`)).toEqual({
      runMetadata: failed.json,
      failedRowCount: 0,
      totalRowCount: 0,
    });
    expect(db.docs.get(`${runsPath()}/latest`)).toEqual({
      runMetadata: failed.json,
      latestRunId: RUN_ID,
      failedRowCount: 0,
      totalRowCount: 0,
    });
  });

  test("a newer failed run replaces a latest document from a successful run", async () => {
    const { db, ctx } = makeContext();
    associate(db);
    const earlierRunId = "earlier-run";

    await handleTransferRunMessage(
      ctx,
      message({ name: runName(earlierRunId), runTime: "2023-03-23T21:00:00Z" })
    );
    await handleTransferRunMessage(
      ctx,
      message({ state: "FAILED", runTime: "2023-03-23T22:00:00Z" })
    );

    const latest = db.docs.get(`${runsPath()}/latest`) as Data;
    expect(latest.latestRunId).toBe(RUN_ID);
    expect((latest.runMetadata as Data).state).toBe("FAILED");
  });

  test("an older run leaves the latest document alone", async () => {
    const { db, ctx } = makeContext();
    associate(db);

    await handleTransferRunMessage(
      ctx,
      message({ runTime: "2023-03-23T22:00:00Z" })
    );
    await handleTransferRunMessage(
      ctx,
      message({
        name: runName("older-run"),
        state: "FAILED",
        runTime: "2023-03-23T21:00:00Z",
      })
    );

    const latest = db.docs.get(`${runsPath()}/latest`) as Data;
    expect(latest.latestRunId).toBe(RUN_ID);
    expect((latest.runMetadata as Data).state).toBe("SUCCEEDED");
    expect(mocks.latestDocUpdateSkipped).toHaveBeenCalledOnce();
  });

  test("a redelivered message for the same run updates latest despite an equal runTime", async () => {
    const { db, ctx } = makeContext();
    associate(db);

    await handleTransferRunMessage(
      ctx,
      message({ state: "FAILED", errorStatus: { message: "Query failed" } })
    );
    expect(
      ((db.docs.get(`${runsPath()}/latest`) as Data).runMetadata as Data).state
    ).toBe("FAILED");

    await handleTransferRunMessage(ctx, message());

    const latest = db.docs.get(`${runsPath()}/latest`) as Data;
    expect((latest.runMetadata as Data).state).toBe("SUCCEEDED");
    expect(latest.latestRunId).toBe(RUN_ID);
    expect(mocks.latestDocUpdateSkipped).not.toHaveBeenCalled();
  });

  test("overwrites a latest document that is missing its run metadata", async () => {
    const { db, ctx } = makeContext();
    associate(db);
    db.docs.set(`${runsPath()}/latest`, { someOtherField: "corrupted" });

    await handleTransferRunMessage(ctx, message());

    const latest = db.docs.get(`${runsPath()}/latest`) as Data;
    expect(latest.latestRunId).toBe(RUN_ID);
    expect(latest.runMetadata).toBeDefined();
    expect(latest.someOtherField).toBeUndefined();
  });
});

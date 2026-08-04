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

import { describe, expect, test, vi } from "vitest";
import type { HandlerContext, TransferRunEvent } from "../src/handlers";
import { handleProcessMessage } from "../src/handlers";
import type { TransferRunPayload } from "../src/types";
import { baseConfig, makeFakeFirestore, runPayload } from "./helpers";

const CONFIG_DOC = {
  id: "config-1",
  data: {
    extInstanceId: baseConfig.instanceId,
    name: "projects/test/locations/us/transferConfigs/config-1",
  },
};

function makeEvent(payload: TransferRunPayload): TransferRunEvent {
  return { data: { message: { json: payload } } } as TransferRunEvent;
}

function makeCtx(
  db: ReturnType<typeof makeFakeFirestore>,
  rows: unknown[] = [{ value: 1 }, { value: 2 }]
): HandlerContext {
  const bigquery = {
    createQueryJob: vi.fn(async () => [
      {
        id: "job-1",
        getQueryResults: vi.fn(async () => [rows]),
      },
    ]),
  };
  return {
    db,
    config: baseConfig,
    bigquery,
    dts: {},
    pubsub: {},
  } as unknown as HandlerContext;
}

describe("handleProcessMessage", () => {
  test("throws when the transfer config is not associated with this instance", async () => {
    const db = makeFakeFirestore({
      transferConfigs: [
        { id: "config-1", data: { extInstanceId: "someone-else" } },
      ],
    });

    await expect(
      handleProcessMessage(makeEvent(runPayload()), makeCtx(db))
    ).rejects.toThrow("not associated with instance");
  });

  test("SUCCEEDED run writes output rows, run doc, and latest doc", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });
    const ctx = makeCtx(db);

    await handleProcessMessage(makeEvent(runPayload()), ctx);

    const output = db._list("transferConfigs/config-1/runs/run-1/output");
    expect(output).toHaveLength(2);

    const runDoc = db._get("transferConfigs/config-1/runs", "run-1");
    expect(runDoc).toMatchObject({ failedRowCount: 0, totalRowCount: 2 });

    const latest = db._get("transferConfigs/config-1/runs", "latest");
    expect(latest).toMatchObject({
      latestRunId: "run-1",
      failedRowCount: 0,
      totalRowCount: 2,
    });
  });

  test("SUCCEEDED run queries the run_time-materialized table name", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });
    const ctx = makeCtx(db);

    await handleProcessMessage(makeEvent(runPayload()), ctx);

    const [jobOptions] = (
      ctx.bigquery.createQueryJob as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    // runTime 12:34:56 UTC materializes the template's %H%M%S.
    expect(jobOptions.query).toBe(
      "SELECT * FROM `test.destination_dataset_id.transactions_123456`"
    );
    expect(jobOptions.location).toBe("us");
  });

  test("non-success run writes zero-count run doc and latest, no output", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });
    const ctx = makeCtx(db);

    await handleProcessMessage(makeEvent(runPayload({ state: "FAILED" })), ctx);

    expect(ctx.bigquery.createQueryJob).not.toHaveBeenCalled();
    expect(db._list("transferConfigs/config-1/runs/run-1/output")).toHaveLength(
      0
    );
    expect(db._get("transferConfigs/config-1/runs", "run-1")).toMatchObject({
      failedRowCount: 0,
      totalRowCount: 0,
    });
    expect(db._get("transferConfigs/config-1/runs", "latest")).toMatchObject({
      latestRunId: "run-1",
      failedRowCount: 0,
      totalRowCount: 0,
    });
  });

  test("newer failed run overwrites latest from an older succeeded run", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });
    const ctx = makeCtx(db);

    await handleProcessMessage(
      makeEvent(runPayload({ runTime: "2026-08-01T10:00:00Z" })),
      ctx
    );
    await handleProcessMessage(
      makeEvent(
        runPayload({
          name: "projects/test/locations/us/transferConfigs/config-1/runs/run-2",
          runTime: "2026-08-01T11:00:00Z",
          state: "FAILED",
        })
      ),
      ctx
    );

    expect(db._get("transferConfigs/config-1/runs", "latest")).toMatchObject({
      latestRunId: "run-2",
      totalRowCount: 0,
    });
  });

  test("older run does not overwrite a newer latest", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });
    const ctx = makeCtx(db);

    await handleProcessMessage(
      makeEvent(runPayload({ runTime: "2026-08-01T12:00:00Z" })),
      ctx
    );
    await handleProcessMessage(
      makeEvent(
        runPayload({
          name: "projects/test/locations/us/transferConfigs/config-1/runs/run-0",
          runTime: "2026-08-01T09:00:00Z",
          state: "FAILED",
        })
      ),
      ctx
    );

    expect(db._get("transferConfigs/config-1/runs", "latest")).toMatchObject({
      latestRunId: "run-1",
    });
  });

  test("same runId updates latest on Pub/Sub redelivery", async () => {
    const db = makeFakeFirestore({ transferConfigs: [CONFIG_DOC] });

    await handleProcessMessage(
      makeEvent(runPayload()),
      makeCtx(db, [{ value: 1 }])
    );
    await handleProcessMessage(
      makeEvent(runPayload()),
      makeCtx(db, [{ value: 1 }, { value: 2 }, { value: 3 }])
    );

    expect(db._get("transferConfigs/config-1/runs", "latest")).toMatchObject({
      latestRunId: "run-1",
      totalRowCount: 3,
    });
  });

  test("recovers a corrupted latest doc missing runMetadata", async () => {
    const db = makeFakeFirestore({
      transferConfigs: [CONFIG_DOC],
      "transferConfigs/config-1/runs": [
        { id: "latest", data: { latestRunId: "old-run" } },
      ],
    });

    await handleProcessMessage(makeEvent(runPayload()), makeCtx(db));

    expect(db._get("transferConfigs/config-1/runs", "latest")).toMatchObject({
      latestRunId: "run-1",
    });
  });
});

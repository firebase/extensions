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

import { BigQuery, Table } from "@google-cloud/bigquery";
import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import { buildMaterializedViewQuery } from "../../../bigquery/snapshot";
import { RawChangelogViewSchema } from "../../../bigquery/schema";

jest.mock("../../../logs");
jest.mock("firebase-functions", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const projectId = "test-project";
const datasetId = "test_dataset";
const rawChangeLogTableName = "posts_raw_changelog";
const rawLatestViewName = "posts_raw_latest";

function fakeBigQuery() {
  return { projectId, query: jest.fn().mockResolvedValue([]) };
}

function fakeView(existingQuery?: string) {
  return {
    getMetadata: jest
      .fn()
      .mockResolvedValue([{ materializedView: { query: existingQuery } }]),
    delete: jest.fn().mockResolvedValue([]),
  };
}

async function createIncrementalView(
  options: { maxStaleness?: string; refreshIntervalMinutes?: number },
  view = fakeView(),
  viewExists = false
) {
  const bq = fakeBigQuery();
  await initializeLatestMaterializedView({
    bq: bq as unknown as BigQuery,
    changeTrackerConfig: {
      datasetId,
      tableId: "posts",
      useMaterializedView: true,
      useIncrementalMaterializedView: true,
      ...options,
    },
    view: view as unknown as Table,
    viewExists,
    rawChangeLogTableName,
    rawLatestViewName,
    schema: RawChangelogViewSchema,
  });
  return { bq, view };
}

describe("initializeLatestMaterializedView incremental options", () => {
  test("emits refresh_interval_minutes in the incremental DDL", async () => {
    const { bq } = await createIncrementalView({ refreshIntervalMinutes: 60 });

    expect(bq.query).toHaveBeenCalledTimes(1);
    const ddl: string = bq.query.mock.calls[0][0];
    expect(ddl).toMatch(/OPTIONS\s*\(\s*refresh_interval_minutes = 60\s*\)/);
    expect(ddl).not.toContain("allow_non_incremental_definition");
  });

  test("emits max_staleness in the incremental DDL", async () => {
    const { bq } = await createIncrementalView({
      maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      refreshIntervalMinutes: 60,
    });

    const ddl: string = bq.query.mock.calls[0][0];
    expect(ddl).toContain("refresh_interval_minutes = 60");
    expect(ddl).toContain(`max_staleness = INTERVAL "4:0:0" HOUR TO SECOND`);
  });

  test("emits no OPTIONS clause when neither option is set", async () => {
    const { bq } = await createIncrementalView({});

    const ddl: string = bq.query.mock.calls[0][0];
    expect(ddl).not.toContain("OPTIONS");
    expect(ddl).toMatch(/CREATE MATERIALIZED VIEW `[^`]+`\s+AS\s*\(/);
  });

  test("does not recreate an existing view whose query is unchanged", async () => {
    const { source } = buildMaterializedViewQuery({
      projectId,
      datasetId,
      tableName: rawChangeLogTableName,
      rawLatestViewName,
      schema: RawChangelogViewSchema,
    });
    const view = fakeView(source);

    const { bq } = await createIncrementalView(
      { refreshIntervalMinutes: 60 },
      view,
      true
    );

    expect(view.delete).not.toHaveBeenCalled();
    expect(bq.query).not.toHaveBeenCalled();
  });
});

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

import { Table } from "@google-cloud/bigquery/build/src/table";
import { tableRequiresUpdate } from "../../bigquery/checkUpdates";
import { ChangeTrackerConfig } from "../../bigquery";
import { PartitioningStrategy } from "../../bigquery/partitioning/config";

interface StubTableOptions {
  clusteringFields?: string[];
  schemaFieldNames?: string[];
  timePartitioning?: { type: string; field?: string };
}

// Offline: the stub's `getMetadata` stands in for the only network call
// `tableRequiresUpdate` can reach (`isTablePartitioned`); every other check
// reads the metadata object directly.
function stubTable({
  clusteringFields,
  schemaFieldNames = [],
  timePartitioning,
}: StubTableOptions = {}): Table {
  const metadata = {
    clustering: clusteringFields ? { fields: clusteringFields } : undefined,
    schema: { fields: schemaFieldNames.map((name) => ({ name })) },
    timePartitioning,
  };
  return {
    metadata,
    getMetadata: async () => [metadata],
  } as unknown as Table;
}

function baseConfig(overrides: Partial<ChangeTrackerConfig>) {
  return {
    datasetId: "d",
    tableId: "t",
    datasetLocation: "us",
    wildcardIds: false,
    clustering: null,
    ...overrides,
  } as ChangeTrackerConfig;
}

const customFieldPartitioning: PartitioningStrategy = {
  granularity: "DAY",
  bigqueryColumnName: "created_at",
  bigqueryColumnType: "TIMESTAMP",
  firestoreFieldName: "created_at",
};

const columnsForNonWildcardTable = {
  documentIdColExists: true,
  pathParamsColExists: false,
  oldDataColExists: true,
};

describe("tableRequiresUpdate (offline)", () => {
  test("null clustering config against an unclustered table is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(),
      config: baseConfig({ clustering: null }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(false);
  });

  test("null clustering config against a clustered table fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({ clusteringFields: ["timestamp"] }),
      config: baseConfig({ clustering: null }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(true);
  });

  test("clustering config against an unclustered table fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(),
      config: baseConfig({ clustering: ["timestamp"] }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(true);
  });

  test("matching clustering is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({ clusteringFields: ["timestamp", "data"] }),
      config: baseConfig({ clustering: ["timestamp", "data"] }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(false);
  });

  test("reordered clustering fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({ clusteringFields: ["data", "timestamp"] }),
      config: baseConfig({ clustering: ["timestamp", "data"] }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(true);
  });

  test("wildcards on with no path_params column fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(),
      config: baseConfig({ clustering: null, wildcardIds: true }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(true);
  });

  test("wildcards on with a path_params column is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(),
      config: baseConfig({ clustering: null, wildcardIds: true }),
      ...columnsForNonWildcardTable,
      pathParamsColExists: true,
    });
    expect(result).toBe(false);
  });

  test("wildcards off with a path_params column still present fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(),
      config: baseConfig({ clustering: null, wildcardIds: false }),
      ...columnsForNonWildcardTable,
      pathParamsColExists: true,
    });
    expect(result).toBe(true);
  });

  test("custom partition column missing from a partitioned table fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({
        schemaFieldNames: ["timestamp", "data"],
        timePartitioning: { type: "DAY", field: "created_at" },
      }),
      config: baseConfig({ partitioning: customFieldPartitioning }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(true);
  });

  test("custom partition column present on a partitioned table is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({
        schemaFieldNames: ["timestamp", "data", "created_at"],
        timePartitioning: { type: "DAY", field: "created_at" },
      }),
      config: baseConfig({ partitioning: customFieldPartitioning }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(false);
  });

  test("timestamp partitioning with the built-in timestamp column is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable({
        schemaFieldNames: ["timestamp", "data"],
        timePartitioning: { type: "DAY", field: "timestamp" },
      }),
      config: baseConfig({
        partitioning: { granularity: "DAY", bigqueryColumnName: "timestamp" },
      }),
      ...columnsForNonWildcardTable,
    });
    expect(result).toBe(false);
  });
});

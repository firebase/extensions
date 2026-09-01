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

// Offline: a config with no partitioning short-circuits
// isValidPartitionForExistingTable before it touches the network, so a bare
// metadata stub is enough.
function stubTable(clusteringFields?: string[]): Table {
  return {
    metadata: {
      clustering: clusteringFields ? { fields: clusteringFields } : undefined,
      schema: { fields: [] },
    },
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

const allColumnsPresent = {
  documentIdColExists: true,
  pathParamsColExists: false,
  oldDataColExists: true,
};

describe("tableRequiresUpdate (offline)", () => {
  test("null clustering config against an unclustered table is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(undefined),
      config: baseConfig({ clustering: null }),
      ...allColumnsPresent,
    });
    expect(result).toBe(false);
  });

  test("null clustering config against a clustered table fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(["timestamp"]),
      config: baseConfig({ clustering: null }),
      ...allColumnsPresent,
    });
    expect(result).toBe(true);
  });

  test("clustering config against an unclustered table fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(undefined),
      config: baseConfig({ clustering: ["timestamp"] }),
      ...allColumnsPresent,
    });
    expect(result).toBe(true);
  });

  test("matching clustering is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(["timestamp", "data"]),
      config: baseConfig({ clustering: ["timestamp", "data"] }),
      ...allColumnsPresent,
    });
    expect(result).toBe(false);
  });

  test("reordered clustering fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(["data", "timestamp"]),
      config: baseConfig({ clustering: ["timestamp", "data"] }),
      ...allColumnsPresent,
    });
    expect(result).toBe(true);
  });

  test("wildcards off with no path_params column is a no-op", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(undefined),
      config: baseConfig({ clustering: null, wildcardIds: false }),
      ...allColumnsPresent,
    });
    expect(result).toBe(false);
  });

  test("wildcards on with no path_params column fires an update", async () => {
    const result = await tableRequiresUpdate({
      table: stubTable(undefined),
      config: baseConfig({ clustering: null, wildcardIds: true }),
      ...allColumnsPresent,
    });
    expect(result).toBe(true);
  });
});

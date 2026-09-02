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

import { describe, expect, test } from "vitest";
import { resolveExportConfig, toTrackerConfig } from "../src/export-config";

describe("resolveExportConfig", () => {
  const minimal = {
    collectionPath: "users",
    datasetId: "analytics",
    tableId: "users",
    projectId: "test-project",
  };

  test("applies defaults for omitted fields", () => {
    const resolved = resolveExportConfig(minimal);

    expect(resolved.projectId).toBe("test-project");
    expect(resolved.datasetLocation).toBe("us");
    expect(resolved.databaseId).toBe("(default)");
    expect(resolved.viewType).toBe("view");
    expect(resolved.wildcardIds).toBe(false);
    expect(resolved.excludeOldData).toBe(false);
    expect(resolved.clustering).toBeNull();
    expect(resolved.logLevel).toBe("info");
  });

  test("keeps caller-supplied values", () => {
    const resolved = resolveExportConfig({
      ...minimal,
      databaseId: "secondary",
      wildcardIds: true,
    });

    expect(resolved.databaseId).toBe("secondary");
    expect(resolved.wildcardIds).toBe(true);
  });

  test("carries required fields through", () => {
    const resolved = resolveExportConfig(minimal);
    expect(resolved.collectionPath).toBe("users");
    expect(resolved.datasetId).toBe("analytics");
    expect(resolved.tableId).toBe("users");
  });
});

describe("toTrackerConfig", () => {
  const base = {
    collectionPath: "users",
    datasetId: "analytics",
    tableId: "users",
    projectId: "test-project",
  };

  test("derives materialized view flags from viewType", () => {
    const plain = toTrackerConfig(resolveExportConfig(base));
    expect(plain.useMaterializedView).toBe(false);
    expect(plain.useIncrementalMaterializedView).toBe(false);

    const incremental = toTrackerConfig(
      resolveExportConfig({ ...base, viewType: "materialized_incremental" })
    );
    expect(incremental.useMaterializedView).toBe(true);
    expect(incremental.useIncrementalMaterializedView).toBe(true);

    const nonIncremental = toTrackerConfig(
      resolveExportConfig({ ...base, viewType: "materialized_non_incremental" })
    );
    expect(nonIncremental.useMaterializedView).toBe(true);
    expect(nonIncremental.useIncrementalMaterializedView).toBe(false);
  });

  test("always skips init (initialization is handled lazily)", () => {
    const tracker = toTrackerConfig(resolveExportConfig(base));
    expect(tracker.skipInit).toBe(true);
  });

  test("maps databaseId onto both firestore fields", () => {
    const tracker = toTrackerConfig(
      resolveExportConfig({ ...base, databaseId: "secondary" })
    );
    expect(tracker.databaseId).toBe("secondary");
    expect(tracker.firestoreInstanceId).toBe("secondary");
  });

  test("uses projectId as the default BigQuery project", () => {
    const tracker = toTrackerConfig(resolveExportConfig(base));
    expect(tracker.bqProjectId).toBe("test-project");
  });

  test("keeps an explicitly configured BigQuery project", () => {
    const tracker = toTrackerConfig(
      resolveExportConfig({ ...base, bqProjectId: "analytics-project" })
    );
    expect(tracker.bqProjectId).toBe("analytics-project");
  });
});

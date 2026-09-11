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

import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions/params", () => ({
  Expression: class Expression<T> {
    value(): T {
      return this.runtimeValue();
    }

    runtimeValue(): T {
      throw new Error("Not implemented");
    }

    toCEL(): string {
      return `{{ ${this.toString()} }}`;
    }

    toJSON(): string {
      return this.toString();
    }
  }, // Mirrors the real StringParam: the env var or "", never the declared
  // default, which only the CLI prompt consults.
  defineString: (_name: string) => ({
    value: () => process.env[_name] || "",
    toString: () => `params.${_name}`,
  }),
  // Mirrors the real IntParam: a missing or blank env var resolves to 0, and
  // the declared default never reaches runtime.
  defineInt: (_name: string, opts?: { default?: number }) => ({
    name: _name,
    value: () => Number.parseInt(process.env[_name] || "0", 10) || 0,
    toString: () => `params.${_name}`,
  }),
  defineBoolean: (_name: string, opts?: { default?: boolean }) => ({
    value: () => opts?.default ?? false,
    toString: () => `params.${_name}`,
  }),
  select: (options: unknown) => ({ select: { options } }),
  expr: (
    strings: TemplateStringsArray,
    ...values: ReadonlyArray<{ toString: () => string }>
  ) => ({
    value: () =>
      strings.reduce(
        (acc, part, index) =>
          `${acc}${values[index - 1]?.toString() ?? ""}${part}`
      ),
    toString: () =>
      strings.reduce(
        (acc, part, index) =>
          `${acc}${values[index - 1]?.toString() ?? ""}${part}`
      ),
  }),
  projectID: { value: () => "test-project" },
}));

import {
  buildPartitioningConfig,
  CONFIG_EXPRESSIONS,
  clustering,
  configFromEnv,
} from "../src/config";
import { resolveExportConfig } from "../src/export-config";

describe("clustering", () => {
  test("splits a comma list", () => {
    expect(clustering("a,b,c")).toEqual(["a", "b", "c"]);
  });

  test("caps at four columns", () => {
    expect(clustering("a,b,c,d,e")).toEqual(["a", "b", "c", "d"]);
  });

  test("empty or undefined becomes null", () => {
    expect(clustering("")).toBeNull();
    expect(clustering(undefined)).toBeNull();
  });
});

describe("buildPartitioningConfig", () => {
  const base = {
    timePartitioningField: undefined,
    timePartitioningFieldType: undefined,
    timePartitioningFirestoreField: undefined,
  };

  test("no granularity and no fields => NONE", () => {
    expect(
      buildPartitioningConfig({ ...base, timePartitioning: null })
    ).toEqual({ granularity: "NONE" });
  });

  test("granularity only", () => {
    expect(
      buildPartitioningConfig({ ...base, timePartitioning: "DAY" })
    ).toEqual({ granularity: "DAY" });
  });

  test("timestamp field shorthand", () => {
    expect(
      buildPartitioningConfig({
        ...base,
        timePartitioning: "DAY",
        timePartitioningField: "timestamp",
      })
    ).toMatchObject({ granularity: "DAY", bigqueryColumnName: "timestamp" });
  });

  test("full custom field", () => {
    expect(
      buildPartitioningConfig({
        timePartitioning: "DAY",
        timePartitioningField: "created",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "createdAt",
      })
    ).toEqual({
      granularity: "DAY",
      bigqueryColumnName: "created",
      bigqueryColumnType: "TIMESTAMP",
      firestoreFieldName: "createdAt",
    });
  });

  test("throws when fields are set without a granularity", () => {
    expect(() =>
      buildPartitioningConfig({
        ...base,
        timePartitioning: null,
        timePartitioningField: "created",
      })
    ).toThrow();
  });

  test("throws on incomplete custom field", () => {
    expect(() =>
      buildPartitioningConfig({
        timePartitioning: "DAY",
        timePartitioningField: "created",
        timePartitioningFieldType: undefined,
        timePartitioningFirestoreField: "createdAt",
      })
    ).toThrow();
  });
});

describe("configFromEnv", () => {
  test("maps params", () => {
    // The CLI resolves the param's default into the env at deploy.
    vi.stubEnv("BIGQUERY_PROJECT_ID", "test-project");
    const config = configFromEnv();
    expect(config.projectId).toBe("test-project");
    expect(config.bqProjectId).toBe("test-project");
    expect(config.databaseId).toBe("(default)");
    expect(config.viewType).toBe("view");
    expect(resolveExportConfig(config)).not.toHaveProperty("location");
    vi.unstubAllEnvs();
  });

  test("reports unset queue params as undefined so the documented defaults apply", () => {
    // IntParam.value() resolves an unset var to 0, which would defeat the
    // `?? 100` / `?? 3` fallbacks in resolveExportConfig.
    const config = configFromEnv();
    expect(config.maxDispatchesPerSecond).toBeUndefined();
    expect(config.maxEnqueueAttempts).toBeUndefined();

    const resolved = resolveExportConfig(config);
    expect(resolved.maxDispatchesPerSecond).toBe(100);
    expect(resolved.maxEnqueueAttempts).toBe(3);
  });

  test("reports a blank queue param as undefined", () => {
    vi.stubEnv("MAX_ENQUEUE_ATTEMPTS", "  ");
    expect(configFromEnv().maxEnqueueAttempts).toBeUndefined();
    vi.unstubAllEnvs();
  });

  test("passes an explicit queue param through", () => {
    vi.stubEnv("MAX_ENQUEUE_ATTEMPTS", "7");
    vi.stubEnv("MAX_DISPATCHES_PER_SECOND", "250");
    const config = configFromEnv();
    expect(config.maxEnqueueAttempts).toBe(7);
    expect(config.maxDispatchesPerSecond).toBe(250);
    vi.unstubAllEnvs();
  });

  test("yes/no selects default to off", () => {
    const config = configFromEnv();
    expect(config.useNewSnapshotQuerySyntax).toBe(false);
    expect(config.excludeOldData).toBe(false);
  });

  test("yes/no selects enable on the extension's literal yes", () => {
    vi.stubEnv("USE_NEW_SNAPSHOT_QUERY_SYNTAX", "yes");
    vi.stubEnv("EXCLUDE_OLD_DATA", "yes");
    const config = configFromEnv();
    expect(config.useNewSnapshotQuerySyntax).toBe(true);
    expect(config.excludeOldData).toBe(true);
    vi.unstubAllEnvs();
  });
  test("yes/no selects forgive the label's case and surrounding whitespace", () => {
    vi.stubEnv("USE_NEW_SNAPSHOT_QUERY_SYNTAX", "Yes");
    vi.stubEnv("EXCLUDE_OLD_DATA", " yes ");
    const config = configFromEnv();
    expect(config.useNewSnapshotQuerySyntax).toBe(true);
    expect(config.excludeOldData).toBe(true);
    vi.unstubAllEnvs();
  });

  test("yes/no selects treat no and anything else as off", () => {
    vi.stubEnv("USE_NEW_SNAPSHOT_QUERY_SYNTAX", "no");
    vi.stubEnv("EXCLUDE_OLD_DATA", "true");
    expect(configFromEnv().useNewSnapshotQuerySyntax).toBe(false);
    expect(configFromEnv().excludeOldData).toBe(false);
    vi.unstubAllEnvs();
  });

  test("exposes deploy-time expressions for trigger metadata", () => {
    expect(CONFIG_EXPRESSIONS.collectionPath.toString()).toBe(
      "params.COLLECTION_PATH"
    );
    expect(CONFIG_EXPRESSIONS.database.toString()).toBe("params.DATABASE");
    expect(CONFIG_EXPRESSIONS.maxDispatchesPerSecond.toString()).toBe(
      "params.MAX_DISPATCHES_PER_SECOND"
    );
    expect(CONFIG_EXPRESSIONS).not.toHaveProperty("location");
  });
});

describe("resolveExportConfig queue defaults", () => {
  test("applies the extension's queue defaults when unset", () => {
    const resolved = resolveExportConfig({
      collectionPath: "users",
      datasetId: "ds",
      tableId: "tbl",
      projectId: "p",
    });
    expect(resolved.maxDispatchesPerSecond).toBe(100);
    expect(resolved.maxEnqueueAttempts).toBe(3);
  });

  test("passes explicit queue values through", () => {
    const resolved = resolveExportConfig({
      collectionPath: "users",
      datasetId: "ds",
      tableId: "tbl",
      projectId: "p",
      maxDispatchesPerSecond: 250,
      maxEnqueueAttempts: 5,
    });
    expect(resolved.maxDispatchesPerSecond).toBe(250);
    expect(resolved.maxEnqueueAttempts).toBe(5);
  });
});

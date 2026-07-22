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
  },
  defineString: (_name: string, opts?: { default?: string }) => ({
    value: () => opts?.default ?? "",
    toString: () => `params.${_name}`,
  }),
  defineInt: (_name: string, opts?: { default?: number }) => ({
    value: () => opts?.default ?? 0,
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
  test("maps params to an ExportConfig with defaults", () => {
    const config = configFromEnv();
    expect(config.projectId).toBe("test-project");
    // SERVICE_ACCOUNT is unset, so the default is left to resolveExportConfig.
    expect(config.serviceAccount).toBeUndefined();
    expect(resolveExportConfig(config).serviceAccount).toBe(
      "firestore-bigquery-export@test-project.iam.gserviceaccount.com"
    );
    expect(config.databaseId).toBe("(default)");
    expect(config.location).toBe("us-central1");
    expect(config.viewType).toBe("view");
  });

  test("exposes deploy-time expressions for trigger metadata", () => {
    expect(CONFIG_EXPRESSIONS.collectionPath.toString()).toBe(
      "params.COLLECTION_PATH"
    );
    expect(CONFIG_EXPRESSIONS.location.toString()).toBe("params.LOCATION");
  });
});

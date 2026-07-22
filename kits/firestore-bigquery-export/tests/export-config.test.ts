import { describe, expect, test } from "vitest";
import { resolveExportConfig, toTrackerConfig } from "../src/export-config";

describe("resolveExportConfig", () => {
  const minimal = {
    collectionPath: "users",
    datasetId: "analytics",
    tableId: "users",
    projectId: "test-project",
  };

  test("derives the default serviceAccount from projectId", () => {
    const resolved = resolveExportConfig(minimal);

    expect(resolved.projectId).toBe("test-project");
    expect(resolved.serviceAccount).toBe(
      "firestore-bigquery-export@test-project.iam.gserviceaccount.com"
    );
  });

  test("keeps an explicit serviceAccount", () => {
    const resolved = resolveExportConfig({
      ...minimal,
      serviceAccount: "custom@example.iam.gserviceaccount.com",
    });

    expect(resolved.serviceAccount).toBe(
      "custom@example.iam.gserviceaccount.com"
    );
  });

  test("applies defaults for omitted fields", () => {
    const resolved = resolveExportConfig(minimal);

    expect(resolved.location).toBe("us-central1");
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
      location: "europe-west2",
      databaseId: "secondary",
      wildcardIds: true,
    });

    expect(resolved.location).toBe("europe-west2");
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
});

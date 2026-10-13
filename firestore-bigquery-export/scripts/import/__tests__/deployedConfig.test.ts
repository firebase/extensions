import { Dataset } from "@google-cloud/bigquery";
import { resolveDeployedConfig } from "../src/deployed-config";

const fakeDataset = (tables: Record<string, any>) =>
  ({
    table: (name: string) => ({
      exists: async () => [name in tables],
      getMetadata: async () => [tables[name]],
    }),
  } as unknown as Dataset);

const base = { tableId: "posts", rawChangeLogName: "posts_raw_changelog" };

const materialized = (allowNonIncrementalDefinition?: boolean) => ({
  type: "MATERIALIZED_VIEW",
  materializedView: { query: "SELECT 1", allowNonIncrementalDefinition },
});

describe("resolveDeployedConfig", () => {
  test("defaults to a plain view with no clustering when nothing is deployed", async () => {
    const result = await resolveDeployedConfig(fakeDataset({}), base);
    expect(result).toEqual({
      viewType: "view",
      clustering: undefined,
      errors: [],
    });
  });

  test("uses the flags when nothing is deployed", async () => {
    const result = await resolveDeployedConfig(fakeDataset({}), {
      ...base,
      viewType: "materialized_incremental",
      clustering: ["timestamp"],
    });
    expect(result).toEqual({
      viewType: "materialized_incremental",
      clustering: ["timestamp"],
      errors: [],
    });
  });

  test("keeps a deployed incremental materialized view and clustering without flags", async () => {
    const result = await resolveDeployedConfig(
      fakeDataset({
        posts_raw_latest: materialized(),
        posts_raw_changelog: {
          type: "TABLE",
          clustering: { fields: ["timestamp"] },
        },
      }),
      base
    );
    expect(result).toEqual({
      viewType: "materialized_incremental",
      clustering: ["timestamp"],
      errors: [],
    });
  });

  test("detects a non-incremental materialized view", async () => {
    const result = await resolveDeployedConfig(
      fakeDataset({ posts_raw_latest: materialized(true) }),
      base
    );
    expect(result.viewType).toBe("materialized_non_incremental");
  });

  test("returns no clustering for an unclustered changelog table", async () => {
    const result = await resolveDeployedConfig(
      fakeDataset({ posts_raw_changelog: { type: "TABLE" } }),
      base
    );
    expect(result.clustering).toEqual([]);
  });

  test("rejects a view type that differs from the deployed view", async () => {
    const result = await resolveDeployedConfig(
      fakeDataset({ posts_raw_latest: { type: "VIEW" } }),
      { ...base, viewType: "materialized_incremental" }
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("posts_raw_latest is view");
  });

  test("accepts a view type that matches the deployed view", async () => {
    const result = await resolveDeployedConfig(
      fakeDataset({ posts_raw_latest: materialized(true) }),
      { ...base, viewType: "materialized_non_incremental" }
    );
    expect(result.errors).toEqual([]);
  });

  test("rejects clustering that differs from the deployed table", async () => {
    const deployed = fakeDataset({
      posts_raw_changelog: {
        type: "TABLE",
        clustering: { fields: ["timestamp", "document_id"] },
      },
    });

    for (const clustering of [
      [],
      ["timestamp"],
      ["document_id", "timestamp"],
    ]) {
      const result = await resolveDeployedConfig(deployed, {
        ...base,
        clustering,
      });
      expect(result.errors).toHaveLength(1);
    }

    const matching = await resolveDeployedConfig(deployed, {
      ...base,
      clustering: ["timestamp", "document_id"],
    });
    expect(matching.errors).toEqual([]);
  });
});

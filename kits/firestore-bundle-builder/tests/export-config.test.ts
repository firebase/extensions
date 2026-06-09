import { describe, expect, test } from "vitest";
import { resolveConfig } from "../src/export-config";

describe("resolveConfig", () => {
  test("applies legacy defaults for optional fields", () => {
    const resolved = resolveConfig({ bundleSpecCollection: "bundles" });
    expect(resolved).toEqual({
      bundleSpecCollection: "bundles",
      bundleStorageBucket: "bundle-builder-files",
      storagePrefix: "bundles",
      region: "us-central1",
      serviceAccount: undefined,
    });
  });

  test("passes through provided values", () => {
    const resolved = resolveConfig({
      bundleSpecCollection: "specs",
      bundleStorageBucket: "my-bucket",
      storagePrefix: "cached",
      region: "europe-west2",
      serviceAccount: "sa@example.iam.gserviceaccount.com",
    });
    expect(resolved).toEqual({
      bundleSpecCollection: "specs",
      bundleStorageBucket: "my-bucket",
      storagePrefix: "cached",
      region: "europe-west2",
      serviceAccount: "sa@example.iam.gserviceaccount.com",
    });
  });

  test("an empty bucket string is preserved (disables caching)", () => {
    const resolved = resolveConfig({
      bundleSpecCollection: "bundles",
      bundleStorageBucket: "",
    });
    expect(resolved.bundleStorageBucket).toBe("");
  });
});

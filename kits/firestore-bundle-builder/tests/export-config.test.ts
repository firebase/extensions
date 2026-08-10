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
import { resolveConfig } from "../src/export-config";

describe("resolveConfig", () => {
  test("applies legacy defaults for optional fields", () => {
    const resolved = resolveConfig({ bundleSpecCollection: "bundles" });
    expect(resolved).toEqual({
      bundleSpecCollection: "bundles",
      bundleStorageBucket: "bundle-builder-files",
      storagePrefix: "bundles",
    });
  });

  test("passes through provided values", () => {
    const resolved = resolveConfig({
      bundleSpecCollection: "specs",
      bundleStorageBucket: "my-bucket",
      storagePrefix: "cached",
    });
    expect(resolved).toEqual({
      bundleSpecCollection: "specs",
      bundleStorageBucket: "my-bucket",
      storagePrefix: "cached",
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

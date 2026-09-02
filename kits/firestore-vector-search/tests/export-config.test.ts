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

import { resolveVectorSearchConfig } from "../src/export-config";

const base = { projectId: "test-project", instanceId: "test-instance" };

describe("resolveVectorSearchConfig", () => {
  test.each(["query", "limit", "prefilters", "result"])(
    "rejects statusFieldName %j",
    (statusFieldName) => {
      expect(() =>
        resolveVectorSearchConfig({ ...base, statusFieldName })
      ).toThrow("would overwrite a query document field");
    }
  );

  test("accepts a non-reserved statusFieldName", () => {
    const config = resolveVectorSearchConfig({
      ...base,
      statusFieldName: "vectorStatus",
    });

    expect(config.statusFieldName).toBe("vectorStatus");
  });

  test("defaults statusFieldName to status", () => {
    expect(resolveVectorSearchConfig(base).statusFieldName).toBe("status");
  });
});

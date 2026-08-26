/*
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
import {
  type BigqueryFirestoreExportConfig,
  resolveConfig,
} from "../src/export-config";

const minimal: BigqueryFirestoreExportConfig = {
  bigqueryDatasetLocation: "US",
  projectId: "test-project",
  instanceId: "users-export",
  datasetId: "analytics",
  tableName: "users",
  queryString: "SELECT * FROM source.users",
  displayName: "Users export",
  schedule: "every 24 hours",
};

describe("resolveConfig", () => {
  test("applies kit defaults", () => {
    expect(resolveConfig(minimal)).toEqual({
      ...minimal,
      pubSubTopic: "kit-users-export-processMessages",
      firestoreCollection: "transferConfigs",
      logLevel: "info",
    });
  });

  test("normalizes optional strings", () => {
    const resolved = resolveConfig({
      ...minimal,
      transferConfigName: "  projects/p/locations/us/transferConfigs/c  ",
      partitioningField: "  created_at  ",
    });

    expect(resolved.transferConfigName).toBe(
      "projects/p/locations/us/transferConfigs/c"
    );
    expect(resolved.partitioningField).toBe("created_at");
  });

  test.each(["instanceId", "datasetId", "tableName", "queryString"] as const)(
    "rejects an empty %s",
    (field) => {
      expect(() => resolveConfig({ ...minimal, [field]: " " })).toThrow(
        `${field} must be a non-empty string.`
      );
    }
  );

  test("rejects unsupported log levels", () => {
    expect(() =>
      resolveConfig({
        ...minimal,
        logLevel: "verbose" as BigqueryFirestoreExportConfig["logLevel"],
      })
    ).toThrow("Unsupported logLevel: verbose");
  });
});

/*
 * Copyright 2019 Google LLC
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
import type { ExportConfig } from "../src/export-config";
import { resolveExportConfig, topicResourceName } from "../src/export-config";

const requiredFields: ExportConfig = {
  projectId: "test",
  displayName: "Rollup",
  datasetId: "ds",
  tableName: "tbl",
  queryString: "SELECT 1",
  schedule: "every 15 minutes",
};

describe("resolveExportConfig", () => {
  test("applies defaults for optional fields", () => {
    const resolved = resolveExportConfig(requiredFields);
    expect(resolved.location).toBe("us-central1");
    expect(resolved.bigqueryDatasetLocation).toBe("US");
    expect(resolved.instanceId).toBe("bigquery-firestore-export");
    expect(resolved.firestoreCollection).toBe("transferConfigs");
    expect(resolved.logLevel).toBe("info");
    expect(resolved.partitioningField).toBeUndefined();
  });

  test("derives the default topic name from the instance id", () => {
    const resolved = resolveExportConfig({
      ...requiredFields,
      instanceId: "my-instance",
    });
    expect(resolved.pubsubTopic).toBe("ext-my-instance-processMessages");
  });

  test("an explicit topic overrides the derived default", () => {
    const resolved = resolveExportConfig({
      ...requiredFields,
      instanceId: "my-instance",
      pubsubTopic: "custom-topic",
    });
    expect(resolved.pubsubTopic).toBe("custom-topic");
  });

  test("resolves param expressions via value()", () => {
    const resolved = resolveExportConfig({
      ...requiredFields,
      displayName: { value: () => "From Param" } as never,
    });
    expect(resolved.displayName).toBe("From Param");
  });

  test("throws on missing required values", () => {
    expect(() =>
      resolveExportConfig({ ...requiredFields, queryString: "" })
    ).toThrow("Missing required config value: queryString");
  });

  test("normalizes unknown log levels to info", () => {
    const resolved = resolveExportConfig({
      ...requiredFields,
      logLevel: "LOUD",
    });
    expect(resolved.logLevel).toBe("info");
  });

  test("accepts upper-case log level values", () => {
    const resolved = resolveExportConfig({
      ...requiredFields,
      logLevel: "DEBUG",
    });
    expect(resolved.logLevel).toBe("debug");
  });
});

describe("topicResourceName", () => {
  test("builds the full resource name", () => {
    const resolved = resolveExportConfig(requiredFields);
    expect(topicResourceName(resolved)).toBe(
      "projects/test/topics/ext-bigquery-firestore-export-processMessages"
    );
  });
});

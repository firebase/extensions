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
  type CaptureConfig,
  resolveCaptureConfig,
  toPipelineCollectionId,
} from "../src/capture-config";

function config(overrides: Partial<CaptureConfig> = {}): CaptureConfig {
  return {
    projectId: "test-project",
    syncCollectionPath: "users",
    backupInstanceId: "backup-db",
    datasetId: "backup_dataset",
    tableId: "backup_table",
    instanceId: "default",
    bucketName: "test-project.firebasestorage.app",
    ...overrides,
  };
}

describe("resolveCaptureConfig", () => {
  test("applies defaults", () => {
    const resolved = resolveCaptureConfig(config());

    expect(resolved.databaseId).toBe("(default)");
    expect(resolved.location).toBe("us-central1");
    expect(resolved.datasetLocation).toBe("us");
    expect(resolved.logLevel).toBe("info");
  });

  test("requires an instance id, which must match the instances map key", () => {
    expect(() => resolveCaptureConfig(config({ instanceId: "" }))).toThrow(
      /INSTANCE_ID is required/
    );
  });

  test("defaults the Dataflow region to the functions location", () => {
    expect(
      resolveCaptureConfig(config({ location: "europe-west1" })).dataflowRegion
    ).toBe("europe-west1");
  });

  test("keeps an explicit Dataflow region", () => {
    const resolved = resolveCaptureConfig(
      config({ location: "europe-west1", dataflowRegion: "us-central1" })
    );

    expect(resolved.dataflowRegion).toBe("us-central1");
  });

  test("resolves without a bucket, so capture works without Cloud Storage", () => {
    // Only restoration needs a bucket. Throwing here would take the capture
    // path down on a project that never enabled Storage.
    const resolved = resolveCaptureConfig(config({ bucketName: "" }));

    expect(resolved.bucketName).toBeUndefined();
    expect(resolved.flexTemplatePath).toBeUndefined();
  });

  test("never guesses a bucket name from the project id", () => {
    // The default bucket domain differs by project age, and a wrong guess means
    // launching against a template that was never staged there.
    const resolved = resolveCaptureConfig(config({ bucketName: "" }));

    expect(JSON.stringify(resolved)).not.toContain("test-project.");
  });

  test("pins the captured database to the only one the pipeline can restore", () => {
    expect(resolveCaptureConfig(config()).databaseId).toBe("(default)");
  });

  test("derives the backup instance name and flex template path", () => {
    const resolved = resolveCaptureConfig(config());

    expect(resolved.backupInstanceName).toBe(
      "projects/test-project/databases/backup-db"
    );
    expect(resolved.flexTemplatePath).toBe(
      "gs://test-project.firebasestorage.app/default-dataflow-restore"
    );
  });

  test("namespaces derived paths by instance id", () => {
    const resolved = resolveCaptureConfig(config({ instanceId: "second" }));

    expect(resolved.flexTemplatePath).toBe(
      "gs://test-project.firebasestorage.app/second-dataflow-restore"
    );
    expect(resolved.restoreCollection).toBe("_second/runs/restorations");
  });

  test("rejects a backup database that is the captured database", () => {
    expect(() =>
      resolveCaptureConfig(config({ backupInstanceId: "(default)" }))
    ).toThrow(/must differ from the captured database/);
  });

  test("rejects an empty backup database", () => {
    expect(() =>
      resolveCaptureConfig(config({ backupInstanceId: "" }))
    ).toThrow(/BACKUP_INSTANCE_ID is required/);
  });
});

describe("toPipelineCollectionId", () => {
  test("maps the capture-everything wildcard to the pipeline's spelling", () => {
    expect(toPipelineCollectionId("{document=**}")).toBe("*");
  });

  test("passes a concrete collection through", () => {
    expect(toPipelineCollectionId("users")).toBe("users");
  });
});

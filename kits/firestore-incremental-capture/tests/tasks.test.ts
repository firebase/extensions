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

import { describe, expect, test, vi } from "vitest";
import {
  type CaptureConfig,
  resolveCaptureConfig,
} from "../src/capture-config";

vi.mock("firebase-admin/functions", () => ({
  getFunctions: vi.fn(),
}));

const { CHANGELOG_TASK_FUNCTION, queueName, RESTORATION_TASK_FUNCTION } =
  await import("../src/tasks");

function config(overrides: Partial<CaptureConfig> = {}) {
  return resolveCaptureConfig({
    projectId: "test-project",
    syncCollectionPath: "users",
    backupInstanceId: "backup-db",
    datasetId: "ds",
    tableId: "tbl",
    instanceId: "default",
    bucketName: "test-project.firebasestorage.app",
    ...overrides,
  });
}

describe("queueName", () => {
  test("carries the kit-<instanceId>- prefix the CLI deploys under", () => {
    // A kit stanza renames every export to kit-<instance id>-<export name>.
    // Without the prefix the enqueue targets a queue that does not exist.
    expect(queueName(config(), CHANGELOG_TASK_FUNCTION)).toBe(
      "locations/us-central1/functions/kit-default-syncChangelogTask"
    );
    expect(queueName(config(), RESTORATION_TASK_FUNCTION)).toBe(
      "locations/us-central1/functions/kit-default-runRestorationTask"
    );
  });

  test("namespaces the queue by instance id", () => {
    expect(
      queueName(config({ instanceId: "orders" }), "syncChangelogTask")
    ).toBe("locations/us-central1/functions/kit-orders-syncChangelogTask");
  });

  test("uses the configured region", () => {
    expect(
      queueName(config({ location: "europe-west1" }), "syncChangelogTask")
    ).toBe("locations/europe-west1/functions/kit-default-syncChangelogTask");
  });
});

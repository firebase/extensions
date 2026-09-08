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
  test("leaves the kit-<instanceId>- prefix to the Admin SDK", () => {
    expect(queueName(config(), CHANGELOG_TASK_FUNCTION)).toBe(
      "locations/us-central1/functions/syncChangelogTask"
    );
    expect(queueName(config(), RESTORATION_TASK_FUNCTION)).toBe(
      "locations/us-central1/functions/runRestorationTask"
    );
  });

  test("does not vary with the instance id", () => {
    expect(
      queueName(config({ instanceId: "orders" }), "syncChangelogTask")
    ).toBe("locations/us-central1/functions/syncChangelogTask");
  });

  test("uses the configured region", () => {
    expect(
      queueName(config({ location: "europe-west1" }), "syncChangelogTask")
    ).toBe("locations/europe-west1/functions/syncChangelogTask");
  });
});

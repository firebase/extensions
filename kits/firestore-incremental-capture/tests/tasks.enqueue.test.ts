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

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  type CaptureConfig,
  resolveCaptureConfig,
} from "../src/capture-config";

const INSTANCE_ID = "capture";

let server: Server;
let paths: string[] = [];

// The Admin SDK only reads CLOUD_TASKS_EMULATOR_HOST and FIREBASE_KIT_INSTANCE_ID
// when the app and the functions client are constructed, so both are set before
// firebase-admin is imported.
beforeAll(async () => {
  server = createServer((request, response) => {
    paths.push(request.url ?? "");
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;
  process.env.CLOUD_TASKS_EMULATOR_HOST = `127.0.0.1:${port}`;
  process.env.FIREBASE_KIT_INSTANCE_ID = INSTANCE_ID;

  const { initializeApp } = await import("firebase-admin/app");
  initializeApp({
    projectId: "test-project",
    serviceAccountId: "tasks@test-project.iam.gserviceaccount.com",
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function config(overrides: Partial<CaptureConfig> = {}) {
  return resolveCaptureConfig({
    projectId: "test-project",
    syncCollectionPath: "users",
    backupInstanceId: "backup-db",
    datasetId: "ds",
    tableId: "tbl",
    instanceId: INSTANCE_ID,
    bucketName: "test-project.firebasestorage.app",
    ...overrides,
  });
}

describe("enqueue", () => {
  test("targets the queue the CLI deploys, prefixed exactly once", async () => {
    paths = [];
    const { CHANGELOG_TASK_FUNCTION, enqueue } = await import("../src/tasks");

    await enqueue(config(), CHANGELOG_TASK_FUNCTION, { path: "users/alice" });

    expect(paths).toEqual([
      "/projects/test-project/locations/us-central1/queues/" +
        "kit-capture-syncChangelogTask/tasks",
    ]);
  });

  // resolveResourceId reads the env var per call, so this state is reachable
  // from the same app: it is what an instance deployed by a CLI that does not
  // set FIREBASE_KIT_INSTANCE_ID would enqueue onto.
  test("has no prefix of its own when the kit instance id is absent", async () => {
    paths = [];
    const { CHANGELOG_TASK_FUNCTION, enqueue } = await import("../src/tasks");
    delete process.env.FIREBASE_KIT_INSTANCE_ID;

    try {
      await enqueue(config(), CHANGELOG_TASK_FUNCTION, { path: "users/alice" });
    } finally {
      process.env.FIREBASE_KIT_INSTANCE_ID = INSTANCE_ID;
    }

    expect(paths).toEqual([
      "/projects/test-project/locations/us-central1/queues/" +
        "syncChangelogTask/tasks",
    ]);
  });

  test("targets the restoration queue, prefixed exactly once", async () => {
    paths = [];
    const { enqueue, RESTORATION_TASK_FUNCTION } = await import("../src/tasks");

    await enqueue(config(), RESTORATION_TASK_FUNCTION, { timestamp: 1 });

    expect(paths).toEqual([
      "/projects/test-project/locations/us-central1/queues/" +
        "kit-capture-runRestorationTask/tasks",
    ]);
  });
});

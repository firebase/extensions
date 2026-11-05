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

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import type { SerializedDocumentChange } from "../src/handlers";

// Real firebase-admin against a local Cloud Tasks emulator host: the kit
// prefix and the default location are resolved by the SDK, which the unit
// suite mocks away.
const INSTANCE_ID = "test-instance";
const REGION_KEYS = ["DATABASE_REGION", "FUNCTION_REGION"] as const;

let server: Server;
let requests: { path: string; body: string }[] = [];
const originalEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ path: request.url ?? "", body });
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.CLOUD_TASKS_EMULATOR_HOST = `127.0.0.1:${port}`;
  process.env.FIREBASE_KIT_INSTANCE_ID = INSTANCE_ID;
  const { initializeApp } = await import("firebase-admin/app");
  initializeApp({
    projectId: "test-project",
    serviceAccountId: "tasks@test-project.iam.gserviceaccount.com",
    credential: {
      getAccessToken: async () => ({
        access_token: "owner",
        expires_in: 3600,
      }),
    },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requests = [];
  for (const key of REGION_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of REGION_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

function change(eventId: string): SerializedDocumentChange {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    eventId,
    fullResourceName: "projects/p/databases/(default)/documents/c/d",
    changeType: "CREATE",
    documentId: "d",
    params: null,
    data: { a: 1 },
    oldData: undefined,
  } as SerializedDocumentChange;
}

function queueUrl(region: string): string {
  return `/projects/test-project/locations/${region}/queues/kit-${INSTANCE_ID}-syncBigQuery/tasks`;
}

describe("enqueueSyncTask against the Admin SDK", () => {
  test("targets the kit-prefixed queue in FUNCTION_REGION", async () => {
    process.env.FUNCTION_REGION = "europe-west2";
    const { enqueueSyncTask } = await import("../src/tasks");
    await enqueueSyncTask(change("evt-1"), 1);
    expect(requests.map((r) => r.path)).toEqual([queueUrl("europe-west2")]);
  });

  test("falls back to the SDK default location with no region variables", async () => {
    const { enqueueSyncTask } = await import("../src/tasks");
    await enqueueSyncTask(change("evt-1"), 1);
    expect(requests.map((r) => r.path)).toEqual([queueUrl("us-central1")]);
  });

  test("names the task by the hashed event id", async () => {
    process.env.FUNCTION_REGION = "us-central1";
    const { enqueueSyncTask } = await import("../src/tasks");
    await enqueueSyncTask(change("a/b:c d"), 1);
    const task = JSON.parse(requests[0].body).task as { name: string };
    expect(task.name).toBe(
      `projects/test-project/locations/us-central1/queues/kit-${INSTANCE_ID}-syncBigQuery/tasks/` +
        createHash("sha256").update("a/b:c d").digest("hex")
    );
  });
});

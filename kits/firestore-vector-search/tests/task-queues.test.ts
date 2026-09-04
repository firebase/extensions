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

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

// `queries/setup` builds a FirestoreAdminClient at module scope; none of the
// enqueue paths need it.
vi.mock("../src/queries/setup", () => ({ createIndex: vi.fn() }));
vi.mock("../src/embeddings", () => ({ createEmbedClient: vi.fn() }));

const INSTANCE_ID = "test-instance";

let server: Server;
let paths: string[] = [];

// The Admin SDK reads CLOUD_TASKS_EMULATOR_HOST when the functions client is
// constructed, so it is set before firebase-admin is imported.
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

beforeEach(() => {
  paths = [];
});

function queueUrl(name: string): string {
  return `/projects/test-project/locations/us-central1/queues/${name}/tasks`;
}

/** A Firestore whose collection get() returns a single document. */
function firestoreWithOneDoc() {
  return {
    collection: vi.fn(() => ({
      get: vi.fn(async () => ({
        docs: [{ ref: { path: "documents/doc-1" } }],
      })),
    })),
  } as unknown as FirebaseFirestore.Firestore;
}

async function context(overrides: Record<string, unknown> = {}) {
  const { resolveVectorSearchConfig } = await import("../src/export-config");
  return {
    firestore: firestoreWithOneDoc(),
    config: resolveVectorSearchConfig({
      projectId: "test-project",
      instanceId: INSTANCE_ID,
      region: "us-central1",
      ...overrides,
    }),
  };
}

describe("task queue targets", () => {
  test("the backfill trigger enqueues onto kit-<instance>-backfillTask", async () => {
    const { handleBackfillTrigger } = await import("../src/handlers");

    await handleBackfillTrigger({ data: undefined } as never, await context());

    expect(paths).toEqual([queueUrl("kit-test-instance-backfillTask")]);
  });

  test("the update trigger enqueues onto kit-<instance>-updateTask", async () => {
    const { handleUpdateTrigger } = await import("../src/handlers");

    await handleUpdateTrigger({ data: undefined } as never, await context());

    expect(paths).toEqual([queueUrl("kit-test-instance-updateTask")]);
  });

  test("init enqueues onto the two trigger queues", async () => {
    const { handleInit } = await import("../src/handlers");

    await handleInit(
      await context({ doBackfill: true, updateOnConfigure: true })
    );

    expect(paths).toEqual([
      queueUrl("kit-test-instance-backfillTrigger"),
      queueUrl("kit-test-instance-updateTrigger"),
    ]);
  });
});

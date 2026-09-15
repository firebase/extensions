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
  afterEach,
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

// Requests carry the test that made them. A test that times out mid-enqueue
// still delivers its request, and an array cleared between tests would hand it
// to the next one; tagging keeps every test reading only its own.
let currentTest = 0;
const requests: { test: number; url: string }[] = [];

/** The queue paths this test enqueued onto, in order. */
function enqueued(): string[] {
  return requests
    .filter((request) => request.test === currentTest)
    .map((request) => request.url);
}

// The Admin SDK reads CLOUD_TASKS_EMULATOR_HOST when the functions client is
// constructed, so it is set before firebase-admin is imported.
beforeAll(async () => {
  server = createServer((request, response) => {
    requests.push({ test: currentTest, url: request.url ?? "" });
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;
  process.env.CLOUD_TASKS_EMULATOR_HOST = `127.0.0.1:${port}`;
  process.env.FIREBASE_KIT_INSTANCE_ID = INSTANCE_ID;

  const { initializeApp } = await import("firebase-admin/app");
  // An explicit credential, never used: the emulator path sends an "owner"
  // token. Under the default one the SDK reaches for application default
  // credentials while building the task payload and throws where there are
  // none, which is any machine that has not run `gcloud auth`.
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
  currentTest += 1;
});

function queueUrl(name: string): string {
  return `/projects/test-project/locations/us-central1/queues/${name}/tasks`;
}

/**
 * A Firestore with one document in the collection and no metadata document,
 * so every trigger pass runs and enqueues exactly one task.
 */
function firestoreWithOneDoc() {
  const doc = (path: string) => ({
    path,
    get: vi.fn(async () => ({ exists: false, data: () => undefined })),
    set: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  });
  return {
    doc: vi.fn(doc),
    collection: vi.fn(() => ({
      listDocuments: vi.fn(async () => [{ id: "doc-1" }]),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn(async () => undefined),
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

// The first enqueue pays for building the Admin SDK's task client, which has
// run past the 5 second default on a cold file system.
describe("task queue targets", { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("the backfill trigger enqueues onto kit-<instance>-backfillTask", async () => {
    const { handleBackfillTrigger } = await import("../src/handlers");

    await handleBackfillTrigger({ data: undefined } as never, await context());

    expect(enqueued()).toEqual([queueUrl("kit-test-instance-backfillTask")]);
  });

  test("the update trigger enqueues onto kit-<instance>-updateTask", async () => {
    const { handleUpdateTrigger } = await import("../src/handlers");

    await handleUpdateTrigger({ data: undefined } as never, await context());

    expect(enqueued()).toEqual([queueUrl("kit-test-instance-updateTask")]);
  });

  test("an unknown region fails rather than guessing one", async () => {
    vi.stubEnv("FUNCTION_REGION", "");
    const { handleBackfillTrigger } = await import("../src/handlers");

    await expect(
      handleBackfillTrigger(
        { data: undefined } as never,
        await context({ region: undefined })
      )
    ).rejects.toThrow("FUNCTION_REGION is required to resolve task queues.");

    expect(enqueued()).toEqual([]);
  });

  test("init enqueues only the backfill trigger when both passes are on", async () => {
    const { handleInit } = await import("../src/handlers");

    await handleInit(
      await context({ doBackfill: true, updateOnConfigure: true })
    );

    expect(enqueued()).toEqual([queueUrl("kit-test-instance-backfillTrigger")]);
  });

  test("init enqueues onto the update trigger queue on its own", async () => {
    const { handleInit } = await import("../src/handlers");

    await handleInit(
      await context({ doBackfill: false, updateOnConfigure: true })
    );

    expect(enqueued()).toEqual([queueUrl("kit-test-instance-updateTrigger")]);
  });
});

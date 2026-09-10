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

import { afterEach, describe, expect, test, vi } from "vitest";

// `queries/setup` builds a FirestoreAdminClient at module scope and
// `embeddings` pulls in the provider SDKs; neither is needed to register the
// triggers.
vi.mock("../src/queries/setup", () => ({ createIndex: vi.fn() }));
vi.mock("../src/embeddings", () => ({ createEmbedClient: vi.fn() }));

// firebase-functions allows one lifecycle hook of each kind per process, and
// the entry is imported once per test.
vi.mock("firebase-functions/v2/lifecycle", () => ({
  afterFirstDeploy: vi.fn(),
  afterRedeploy: vi.fn(),
}));

// The deploy entry resolves the query trigger path when it loads, so the
// environment has to be in place before each import.
async function importIndex(instanceId: string | undefined) {
  vi.resetModules();
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", instanceId);
  return import("../src/index");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deploy entry", () => {
  test("names the query trigger collection after the instance id", async () => {
    const { queryOnWrite } = await importIndex("test-instance");

    expect(queryOnWrite.__endpoint.eventTrigger).toMatchObject({
      eventFilterPathPatterns: {
        document: "_test-instance/index/queries/{queryId}",
      },
    });
  });

  test("pins every function in the instance to the database's region", async () => {
    vi.stubEnv("DATABASE_REGION", "europe-west4");
    const entry = await importIndex("test-instance");

    const endpoints = Object.values(entry).filter(
      (value): value is { __endpoint: { region?: string[] } } =>
        typeof value === "function" && "__endpoint" in value
    );

    // Task queues are resolved from the enqueuing function's own region, so a
    // single function left unpinned would enqueue against a missing queue.
    expect(endpoints).toHaveLength(8);
    for (const endpoint of endpoints) {
      expect(endpoint.__endpoint.region).toEqual(["europe-west4"]);
    }
  });

  test("maps a multi-region database location to a Cloud Run region", async () => {
    vi.stubEnv("DATABASE_REGION", "eur3");
    const { embedOnWrite } = await importIndex("test-instance");

    expect(embedOnWrite.__endpoint.region).toEqual(["europe-west1"]);
  });

  test("declares no region when DATABASE_REGION is unset", async () => {
    vi.stubEnv("DATABASE_REGION", undefined);
    const { embedOnWrite } = await importIndex("test-instance");

    expect(embedOnWrite.__endpoint.region).toBeUndefined();
  });

  test("fails discovery when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    await expect(importIndex(undefined)).rejects.toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });
});

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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/logs");
vi.mock("../src/events");

import {
  publishSearch,
  runBatchPubSubDeletions,
} from "../src/runBatchPubSubDeletions";
import { createFakeFirestore, makeContext } from "./fakes";

const UID = "testUid";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runBatchPubSubDeletions", () => {
  // Parity: delete-user-data/functions/__tests__/runBatchPubSubDeletions.test.ts
  test("cannot delete paths with an invalid userId", async () => {
    const firestore = createFakeFirestore({
      "runBatchPubSubDeletions/doc1": { testing: "testing" },
    });
    const ctx = makeContext({ firestore });

    await runBatchPubSubDeletions(
      { firestorePaths: ["runBatchPubSubDeletions/doc1"] },
      "invalidUserId",
      ctx
    );
    await ctx.drain();

    expect(firestore.exists("runBatchPubSubDeletions/doc1")).toBe(true);
  });

  test("publishes the paths to the deletion topic", async () => {
    const ctx = makeContext();

    await runBatchPubSubDeletions(
      { firestorePaths: ["users/doc1", "users/doc2"] },
      UID,
      ctx
    );

    expect(ctx.pubsub.published).toEqual([
      {
        topic: "projects/demo-test/topics/kit-test-instance-deletion",
        json: { paths: ["users/doc1", "users/doc2"], uid: UID },
      },
    ]);
  });

  test("chunks the paths into messages of 450", async () => {
    const ctx = makeContext();
    const firestorePaths = Array.from(
      { length: 901 },
      (_value, index) => `users/doc${index}`
    );

    await runBatchPubSubDeletions({ firestorePaths }, UID, ctx);

    expect(ctx.pubsub.published).toHaveLength(3);
    expect(
      ctx.pubsub.published.map(
        (message) => (message.json as { paths: string[] }).paths.length
      )
    ).toEqual([450, 450, 1]);
  });

  test("publishes nothing for an empty path list", async () => {
    const ctx = makeContext();

    await runBatchPubSubDeletions({ firestorePaths: [] }, UID, ctx);

    expect(ctx.pubsub.published).toEqual([]);
  });

  test("publishes nothing when firestorePaths is not an array", async () => {
    const ctx = makeContext();

    await runBatchPubSubDeletions(
      { firestorePaths: undefined as unknown as string[] },
      UID,
      ctx
    );
    await runBatchPubSubDeletions(
      { firestorePaths: "users/doc1" as unknown as string[] },
      UID,
      ctx
    );

    expect(ctx.pubsub.published).toEqual([]);
  });
});

describe("topic resolution", () => {
  test("falls back to GOOGLE_CLOUD_PROJECT when the config has no project id", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "env-project");
    const ctx = makeContext({ config: { projectId: undefined } });

    await publishSearch(UID, 1, "users", ctx);

    expect(ctx.pubsub.published[0].topic).toBe(
      "projects/env-project/topics/kit-test-instance-discovery"
    );
  });

  test("falls back to PROJECT_ID", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", undefined);
    vi.stubEnv("PROJECT_ID", "legacy-project");
    const ctx = makeContext({ config: { projectId: undefined } });

    await publishSearch(UID, 1, "users", ctx);

    expect(ctx.pubsub.published[0].topic).toBe(
      "projects/legacy-project/topics/kit-test-instance-discovery"
    );
  });

  test("uses the bare topic name when no project id can be resolved", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", undefined);
    vi.stubEnv("PROJECT_ID", undefined);
    const ctx = makeContext({ config: { projectId: undefined } });

    await publishSearch(UID, 1, "users", ctx);

    expect(ctx.pubsub.published[0].topic).toBe("kit-test-instance-discovery");
  });
});

describe("publishSearch", () => {
  test("publishes the path, uid and depth", async () => {
    const ctx = makeContext();

    await publishSearch(UID, 2, "users/doc1/posts", ctx);

    expect(ctx.pubsub.published).toEqual([
      {
        topic: "projects/demo-test/topics/kit-test-instance-discovery",
        json: { path: "users/doc1/posts", uid: UID, depth: 2 },
      },
    ]);
  });
});

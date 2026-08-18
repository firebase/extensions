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

import type { PubSub } from "@google-cloud/pubsub";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { resolveDeleteUserDataConfig } from "../src/export-config";
import {
  type PublisherContext,
  publishSearch,
  runBatchPubSubDeletions,
} from "../src/runBatchPubSubDeletions";

/** Fake PubSub recording the topic each message was published to. */
function fakePubSub() {
  const published: { topic: string; json: unknown }[] = [];
  const publishMessage = vi.fn();
  const topic = vi.fn((topicName: string) => ({
    publishMessage: (message: { json: unknown }) => {
      published.push({ topic: topicName, json: message.json });
      return publishMessage(message);
    },
  }));
  return { published, topic, pubsub: { topic } as unknown as PubSub };
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  const { pubsub, published, topic } = fakePubSub();
  const ctx: PublisherContext = {
    pubsub,
    config: resolveDeleteUserDataConfig({
      instanceId: "inst",
      projectId: "test-project",
      ...overrides,
    }),
  };
  return { ctx, published, topic };
}

describe("runBatchPubSubDeletions", () => {
  beforeEach(() => vi.clearAllMocks());

  test("publishes the paths to the deletion topic", async () => {
    const { ctx, published } = makeCtx();

    await runBatchPubSubDeletions(
      { firestorePaths: ["users/uid1", "logs/uid1"] },
      "uid1",
      ctx
    );

    expect(published).toEqual([
      {
        topic: "projects/test-project/topics/kit-inst-deletion",
        json: { paths: ["users/uid1", "logs/uid1"], uid: "uid1" },
      },
    ]);
  });

  test("chunks paths so a single message stays under the batch limit", async () => {
    const { ctx, published } = makeCtx();
    const paths = Array.from({ length: 901 }, (_, i) => `users/uid1/doc${i}`);

    await runBatchPubSubDeletions({ firestorePaths: paths }, "uid1", ctx);

    expect(published).toHaveLength(3);
    expect(
      published.map((message) => (message.json as { paths: string[] }).paths)
    ).toEqual([paths.slice(0, 450), paths.slice(450, 900), paths.slice(900)]);
  });

  test("publishes nothing for an empty or missing path list", async () => {
    const { ctx, published } = makeCtx();

    await runBatchPubSubDeletions({ firestorePaths: [] }, "uid1", ctx);
    await runBatchPubSubDeletions(
      {} as { firestorePaths: string[] },
      "uid1",
      ctx
    );

    expect(published).toHaveLength(0);
  });

  test("falls back to the bare topic name without a project id", async () => {
    const { ctx, published } = makeCtx({ projectId: undefined });
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.PROJECT_ID;

    await runBatchPubSubDeletions(
      { firestorePaths: ["users/uid1"] },
      "uid1",
      ctx
    );

    expect(published[0].topic).toBe("kit-inst-deletion");
  });
});

describe("publishSearch", () => {
  test("publishes the path and depth to the discovery topic", async () => {
    const { ctx, published } = makeCtx();

    await publishSearch("uid1", 2, "users", ctx);

    expect(published).toEqual([
      {
        topic: "projects/test-project/topics/kit-inst-discovery",
        json: { path: "users", uid: "uid1", depth: 2 },
      },
    ]);
  });
});

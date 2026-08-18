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

vi.mock("node-fetch", () => ({ default: vi.fn() }));
vi.mock("../src/logs");

import fetch from "node-fetch";
import { resolveDeleteUserDataConfig } from "../src/export-config";
import * as logs from "../src/logs";
import type { PublisherContext } from "../src/runBatchPubSubDeletions";
import { runCustomSearchFunction } from "../src/runCustomSearchFunction";

const mockFetch = vi.mocked(fetch);

function makeCtx(searchFunction?: string) {
  const published: unknown[] = [];
  const ctx: PublisherContext = {
    pubsub: {
      topic: () => ({
        publishMessage: (message: { json: unknown }) => {
          published.push(message.json);
          return Promise.resolve("id");
        },
      }),
    } as unknown as PubSub,
    config: resolveDeleteUserDataConfig({
      instanceId: "inst",
      projectId: "test-project",
      searchFunction,
    }),
  };
  return { ctx, published };
}

function response(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Awaited<ReturnType<typeof fetch>>;
}

describe("runCustomSearchFunction", () => {
  beforeEach(() => vi.clearAllMocks());

  test("does nothing when no search function is configured", async () => {
    const { ctx, published } = makeCtx();

    await runCustomSearchFunction("uid1", ctx);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(published).toHaveLength(0);
  });

  test("posts the uid and queues the returned paths", async () => {
    const { ctx, published } = makeCtx("https://example.com/search");
    mockFetch.mockResolvedValue(
      response({ firestorePaths: ["users/uid1", "logs/uid1"] })
    );

    await runCustomSearchFunction("uid1", ctx);

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/search", {
      method: "POST",
      body: JSON.stringify({ uid: "uid1" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(published).toEqual([
      { paths: ["users/uid1", "logs/uid1"], uid: "uid1" },
    ]);
  });

  test("accepts a bare array of paths", async () => {
    const { ctx, published } = makeCtx("https://example.com/search");
    mockFetch.mockResolvedValue(response(["users/uid1"]));

    await runCustomSearchFunction("uid1", ctx);

    expect(published).toEqual([{ paths: ["users/uid1"], uid: "uid1" }]);
  });

  test("logs and queues nothing when the function fails", async () => {
    const { ctx, published } = makeCtx("https://example.com/search");
    mockFetch.mockResolvedValue(response({ error: "boom" }, false));

    await runCustomSearchFunction("uid1", ctx);

    expect(logs.customFunctionError).toHaveBeenCalled();
    expect(published).toHaveLength(0);
  });
});

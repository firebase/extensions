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

import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveConfig } from "../src/export-config";
import type { HandlerContext } from "../src/handlers";

const mocks = vi.hoisted(() => ({
  createTransferConfig: vi.fn(),
  getTransferConfig: vi.fn(),
  updateTransferConfig: vi.fn(),
  topicCreated: vi.fn(),
}));

vi.mock("../src/dts", () => ({
  createTransferConfig: mocks.createTransferConfig,
  getTransferConfig: mocks.getTransferConfig,
  updateTransferConfig: mocks.updateTransferConfig,
}));

vi.mock("../src/logs", () => ({
  complete: vi.fn(),
  error: vi.fn(),
  start: vi.fn(),
  topicCreated: mocks.topicCreated,
}));

import { handleUpsertTransferConfig } from "../src/handlers";

const config = resolveConfig({
  bigqueryDatasetLocation: "US",
  projectId: "test-project",
  instanceId: "users-export",
  datasetId: "analytics",
  tableName: "users",
  queryString: "SELECT * FROM source.users",
  displayName: "Users export",
  schedule: "every 24 hours",
});

function makeContext(options: { topicExists: boolean }) {
  const set = vi.fn();
  const exists = vi.fn().mockResolvedValue([options.topicExists]);
  const topic = vi.fn(() => ({ exists }));
  const createTopic = vi.fn().mockResolvedValue(undefined);
  const collection = vi.fn(() => ({
    doc: vi.fn(() => ({ set })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    })),
  }));

  return {
    ctx: {
      db: { collection },
      bigquery: {},
      dataTransfer: {},
      pubsub: { topic, createTopic },
      config,
    } as unknown as HandlerContext,
    topic,
    createTopic,
  };
}

/** gRPC status codes surfaced by the Pub/Sub admin client. */
const ALREADY_EXISTS = 6;
const PERMISSION_DENIED = 7;

function grpcError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTransferConfig.mockResolvedValue({
    name: "projects/p/locations/us/transferConfigs/config-1",
  });
});

describe("ensureNotificationTopic", () => {
  test("does not create the topic when it already exists", async () => {
    const { ctx, topic, createTopic } = makeContext({ topicExists: true });

    await handleUpsertTransferConfig(ctx);

    expect(topic).toHaveBeenCalledWith(config.pubSubTopic);
    expect(createTopic).not.toHaveBeenCalled();
    expect(mocks.topicCreated).not.toHaveBeenCalled();
  });

  test("creates the topic when it does not exist", async () => {
    const { ctx, createTopic } = makeContext({ topicExists: false });

    await handleUpsertTransferConfig(ctx);

    expect(createTopic).toHaveBeenCalledWith(config.pubSubTopic);
    expect(mocks.topicCreated).toHaveBeenCalledWith(config.pubSubTopic);
  });

  test("swallows ALREADY_EXISTS from a concurrent create", async () => {
    const { ctx, createTopic } = makeContext({ topicExists: false });
    createTopic.mockRejectedValue(
      grpcError(ALREADY_EXISTS, "Topic already exists")
    );

    await expect(handleUpsertTransferConfig(ctx)).resolves.toBeUndefined();

    expect(mocks.topicCreated).not.toHaveBeenCalled();
    expect(mocks.createTransferConfig).toHaveBeenCalledOnce();
  });

  test("rethrows other gRPC failures and skips the transfer config", async () => {
    const { ctx, createTopic } = makeContext({ topicExists: false });
    createTopic.mockRejectedValue(
      grpcError(PERMISSION_DENIED, "User not authorized")
    );

    await expect(handleUpsertTransferConfig(ctx)).rejects.toThrow(
      "User not authorized"
    );

    expect(mocks.createTransferConfig).not.toHaveBeenCalled();
  });

  test("rethrows errors that carry no gRPC status code", async () => {
    const { ctx, createTopic } = makeContext({ topicExists: false });
    createTopic.mockRejectedValue(new Error("network unreachable"));

    await expect(handleUpsertTransferConfig(ctx)).rejects.toThrow(
      "network unreachable"
    );

    expect(mocks.createTransferConfig).not.toHaveBeenCalled();
  });
});

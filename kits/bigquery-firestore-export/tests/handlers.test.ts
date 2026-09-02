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
import type { HandlerContext } from "../src/handlers";
import { resolveConfig } from "../src/export-config";

const mocks = vi.hoisted(() => ({
  createTransferConfig: vi.fn(),
  getTransferConfig: vi.fn(),
  updateNotificationTopic: vi.fn(),
  updateTransferConfig: vi.fn(),
  handleTransferRunMessage: vi.fn(),
}));

vi.mock("../src/dts", () => ({
  createTransferConfig: mocks.createTransferConfig,
  getTransferConfig: mocks.getTransferConfig,
  updateNotificationTopic: mocks.updateNotificationTopic,
  updateTransferConfig: mocks.updateTransferConfig,
}));

vi.mock("../src/helper", () => ({
  handleTransferRunMessage: mocks.handleTransferRunMessage,
  parseTransferConfigName: (name: string) => ({
    transferConfigId: name.split("/").at(-1),
  }),
}));

vi.mock("../src/logs", () => ({
  complete: vi.fn(),
  error: vi.fn(),
  start: vi.fn(),
  topicCreated: vi.fn(),
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

function makeContext(options: {
  existing?: { empty: boolean; docs: Array<{ data(): object }> };
  transferConfigName?: string;
}) {
  const set = vi.fn();
  const get = vi.fn().mockResolvedValue(
    options.existing ?? {
      empty: true,
      docs: [],
    }
  );
  const collection = vi.fn(() => ({
    doc: vi.fn(() => ({ set })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({ get })),
    })),
  }));
  const topic = vi.fn(() => ({
    exists: vi.fn().mockResolvedValue([true]),
  }));
  const createTopic = vi.fn();

  return {
    ctx: {
      db: { collection },
      bigquery: {},
      dataTransfer: {},
      pubsub: { topic, createTopic },
      config: { ...config, transferConfigName: options.transferConfigName },
    } as unknown as HandlerContext,
    set,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleUpsertTransferConfig", () => {
  test("creates and stores a transfer config for a new instance", async () => {
    const created = {
      name: "projects/p/locations/us/transferConfigs/config-1",
      displayName: "Users export",
    };
    mocks.createTransferConfig.mockResolvedValue(created);
    const { ctx, set } = makeContext({});

    await handleUpsertTransferConfig(ctx);

    expect(mocks.createTransferConfig).toHaveBeenCalledWith(
      ctx.dataTransfer,
      ctx.config
    );
    expect(set).toHaveBeenCalledWith({
      extInstanceId: "users-export",
      ...created,
    });
  });

  test("stores the object returned by an update without reading it twice", async () => {
    const updated = {
      name: "projects/p/locations/us/transferConfigs/config-1",
      displayName: "Updated users export",
    };
    mocks.updateTransferConfig.mockResolvedValue(updated);
    const { ctx, set } = makeContext({
      existing: {
        empty: false,
        docs: [
          {
            data: () => ({
              name: "projects/p/locations/us/transferConfigs/config-1",
            }),
          },
        ],
      },
    });

    await handleUpsertTransferConfig(ctx);

    expect(mocks.updateTransferConfig).toHaveBeenCalledOnce();
    expect(mocks.getTransferConfig).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      extInstanceId: "users-export",
      ...updated,
    });
  });

  test("links an explicitly named transfer config and repoints its topic", async () => {
    const linked = {
      name: "projects/p/locations/us/transferConfigs/config-2",
      notificationPubsubTopic: "projects/p/topics/ext-old-topic",
    };
    const notifying = {
      ...linked,
      notificationPubsubTopic:
        "projects/test-project/topics/kit-users-export-processMessages",
    };
    mocks.getTransferConfig.mockResolvedValue(linked);
    mocks.updateNotificationTopic.mockResolvedValue(notifying);
    const { ctx, set } = makeContext({
      transferConfigName: linked.name,
    });

    await handleUpsertTransferConfig(ctx);

    expect(mocks.getTransferConfig).toHaveBeenCalledWith(
      ctx.dataTransfer,
      linked.name
    );
    expect(mocks.updateNotificationTopic).toHaveBeenCalledWith(
      ctx.dataTransfer,
      linked,
      ctx.config
    );
    expect(mocks.updateTransferConfig).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      extInstanceId: "users-export",
      ...notifying,
    });
  });
});

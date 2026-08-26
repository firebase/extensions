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
import { PARTITIONING_FIELD_REMOVAL_ERROR } from "../src/dts";
import { PermanentConfigurationError } from "../src/errors";
import { resolveConfig } from "../src/export-config";
import type { HandlerContext } from "../src/handlers";
import * as logs from "../src/logs";

const mocks = vi.hoisted(() => ({
  createTransferConfig: vi.fn(),
  getTransferConfig: vi.fn(),
  updateTransferConfig: vi.fn(),
  handleTransferRunMessage: vi.fn(),
}));

vi.mock("../src/dts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/dts")>()),
  createTransferConfig: mocks.createTransferConfig,
  getTransferConfig: mocks.getTransferConfig,
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
  upsertTransferConfigAborted: vi.fn(),
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
  existing?: { empty: boolean; docs: Array<{ id?: string; data(): object }> };
  existingError?: Error;
  transferConfigName?: string;
}) {
  const set = vi.fn();
  const get = options.existingError
    ? vi.fn().mockRejectedValue(options.existingError)
    : vi.fn().mockResolvedValue(
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

    await handleUpsertTransferConfig(() => ctx);

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

    await handleUpsertTransferConfig(() => ctx);

    expect(mocks.updateTransferConfig).toHaveBeenCalledOnce();
    expect(mocks.getTransferConfig).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      extInstanceId: "users-export",
      ...updated,
    });
  });

  test("links an explicitly named transfer config without updating it", async () => {
    const linked = {
      name: "projects/p/locations/us/transferConfigs/config-2",
    };
    mocks.getTransferConfig.mockResolvedValue(linked);
    const { ctx, set } = makeContext({
      transferConfigName: linked.name,
    });

    await handleUpsertTransferConfig(() => ctx);

    expect(mocks.getTransferConfig).toHaveBeenCalledWith(
      ctx.dataTransfer,
      linked.name
    );
    expect(mocks.updateTransferConfig).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      extInstanceId: "users-export",
      ...linked,
    });
  });
});

describe("handleUpsertTransferConfig permanent failures", () => {
  const aborted = vi.mocked(logs.upsertTransferConfigAborted);

  test("stops when the linked transfer config does not exist", async () => {
    mocks.getTransferConfig.mockResolvedValue(null);
    const { ctx, set } = makeContext({
      transferConfigName: "projects/p/locations/us/transferConfigs/missing",
    });

    await expect(
      handleUpsertTransferConfig(() => ctx)
    ).resolves.toBeUndefined();

    expect(set).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledOnce();
    expect(aborted.mock.calls[0][0].message).toContain(
      "Transfer config not found: projects/p/locations/us/transferConfigs/missing"
    );
    expect(aborted.mock.calls[0][0].message).toContain(
      "Set TRANSFER_CONFIG_NAME"
    );
  });

  test("stops when the partitioning field is cleared on an existing config", async () => {
    mocks.updateTransferConfig.mockRejectedValue(
      new PermanentConfigurationError(PARTITIONING_FIELD_REMOVAL_ERROR)
    );
    const { ctx, set } = makeContext({
      existing: {
        empty: false,
        docs: [
          {
            id: "config-1",
            data: () => ({
              name: "projects/p/locations/us/transferConfigs/config-1",
            }),
          },
        ],
      },
    });

    await expect(
      handleUpsertTransferConfig(() => ctx)
    ).resolves.toBeUndefined();

    expect(set).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledOnce();
    expect(aborted.mock.calls[0][0].message).toBe(
      PARTITIONING_FIELD_REMOVAL_ERROR
    );
  });

  test("stops when the stored transfer config document has no name", async () => {
    const { ctx, set } = makeContext({
      existing: {
        empty: false,
        docs: [
          { id: "config-1", data: () => ({ extInstanceId: "users-export" }) },
        ],
      },
    });

    await expect(
      handleUpsertTransferConfig(() => ctx)
    ).resolves.toBeUndefined();

    expect(mocks.updateTransferConfig).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledOnce();
    expect(aborted.mock.calls[0][0].message).toContain(
      "Existing transfer config document config-1 in transferConfigs is missing required 'name' field"
    );
  });

  test("stops when the transfer config has an unsupported structure", async () => {
    mocks.updateTransferConfig.mockRejectedValue(
      new PermanentConfigurationError(
        "Transfer config has invalid structure: missing params.fields. Only scheduled queries are supported."
      )
    );
    const { ctx, set } = makeContext({
      existing: {
        empty: false,
        docs: [
          {
            id: "config-1",
            data: () => ({
              name: "projects/p/locations/us/transferConfigs/config-1",
            }),
          },
        ],
      },
    });

    await expect(
      handleUpsertTransferConfig(() => ctx)
    ).resolves.toBeUndefined();

    expect(set).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalledOnce();
    expect(aborted.mock.calls[0][0].message).toContain(
      "Transfer config has invalid structure"
    );
  });
});

describe("handleUpsertTransferConfig transient failures", () => {
  const aborted = vi.mocked(logs.upsertTransferConfigAborted);

  test("rethrows a BigQuery error so the task is retried", async () => {
    const unavailable = Object.assign(
      new Error("14 UNAVAILABLE: no healthy upstream"),
      {
        code: 14,
      }
    );
    mocks.createTransferConfig.mockRejectedValue(unavailable);
    const { ctx } = makeContext({});

    await expect(handleUpsertTransferConfig(() => ctx)).rejects.toBe(
      unavailable
    );
    expect(aborted).not.toHaveBeenCalled();
  });

  test("rethrows a Firestore error so the task is retried", async () => {
    const unavailable = new Error("5 DEADLINE_EXCEEDED: Deadline exceeded");
    const { ctx } = makeContext({ existingError: unavailable });

    await expect(handleUpsertTransferConfig(() => ctx)).rejects.toBe(
      unavailable
    );
    expect(aborted).not.toHaveBeenCalled();
  });
});

describe("handleUpsertTransferConfig context resolution", () => {
  const aborted = vi.mocked(logs.upsertTransferConfigAborted);

  test("aborts when building the context hits a misconfiguration", async () => {
    const invalid = new PermanentConfigurationError(
      "datasetId must be a non-empty string. Set it in the deployment configuration, then redeploy."
    );

    await expect(
      handleUpsertTransferConfig(() => {
        throw invalid;
      })
    ).resolves.toBeUndefined();
    expect(aborted).toHaveBeenCalledWith(invalid);
  });

  test("rethrows a transient context failure so the task is retried", async () => {
    const unavailable = new Error("14 UNAVAILABLE: metadata server");

    await expect(
      handleUpsertTransferConfig(() => {
        throw unavailable;
      })
    ).rejects.toBe(unavailable);
    expect(aborted).not.toHaveBeenCalled();
  });
});

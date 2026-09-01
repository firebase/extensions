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

import { describe, expect, test, vi } from "vitest";
import {
  constructUpdateTransferConfigRequest,
  createTransferConfig,
  type DataTransferClient,
  getTransferConfig,
  type TransferConfig,
  updateTransferConfig,
} from "../src/dts";
import { resolveConfig } from "../src/export-config";

vi.mock("../src/logs", () => ({
  createTransferConfig: vi.fn(),
  getTransferConfigFailed: vi.fn(),
  partitioningFieldRemovalAttempted: vi.fn(),
  transferConfigCreated: vi.fn(),
  transferConfigNotFound: vi.fn(),
  transferConfigUpdated: vi.fn(),
  updateTransferConfig: vi.fn(),
}));

const TRANSFER_CONFIG_NAME =
  "projects/test-project/locations/us/transferConfigs/642f3a36-0000-2fbb-ad1d-001a114e2fa6";
const EXPECTED_TOPIC =
  "projects/test-project/topics/kit-users-export-processMessages";
const GRPC_NOT_FOUND = 5;

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

/** A stored config that already matches `config` in every comparable field. */
function unchangedTransferConfig(): TransferConfig {
  return {
    name: TRANSFER_CONFIG_NAME,
    dataSourceId: "scheduled_query",
    destinationDatasetId: "analytics",
    displayName: "Users export",
    notificationPubsubTopic: EXPECTED_TOPIC,
    schedule: "every 24 hours",
    params: {
      fields: {
        query: { stringValue: "SELECT * FROM source.users" },
        destination_table_name_template: {
          stringValue: 'users_{run_time|"%H%M%S"}',
        },
        write_disposition: { stringValue: "WRITE_TRUNCATE" },
        partitioning_field: { stringValue: "" },
      },
    },
  } as TransferConfig;
}

function clientReturning(transferConfig: TransferConfig | null) {
  return {
    getTransferConfig: vi.fn().mockResolvedValue([transferConfig]),
    createTransferConfig: vi.fn(),
    updateTransferConfig: vi.fn(),
  } as unknown as DataTransferClient & {
    getTransferConfig: ReturnType<typeof vi.fn>;
    createTransferConfig: ReturnType<typeof vi.fn>;
    updateTransferConfig: ReturnType<typeof vi.fn>;
  };
}

function clientRejecting(err: unknown) {
  return {
    getTransferConfig: vi.fn().mockRejectedValue(err),
  } as unknown as DataTransferClient;
}

function grpcNotFound(): Error {
  return Object.assign(new Error("Transfer config not found"), {
    code: GRPC_NOT_FOUND,
  });
}

describe("constructUpdateTransferConfigRequest change detection", () => {
  test("rejects when the stored config cannot be read", async () => {
    await expect(
      constructUpdateTransferConfigRequest(
        clientReturning(null),
        TRANSFER_CONFIG_NAME,
        config
      )
    ).rejects.toThrow("Transfer config not found");
  });

  test("produces an empty update mask when nothing changed", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      config
    );

    expect(request.updateMask?.paths).toEqual([]);
    expect(request.transferConfig).toEqual(unchangedTransferConfig());
  });

  test("masks the schedule alone when only the schedule changed", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, schedule: "every 15 minutes" }
    );

    expect(request.updateMask?.paths).toEqual(["schedule"]);
    expect(request.transferConfig?.schedule).toBe("every 15 minutes");
    expect(
      request.transferConfig?.params?.fields?.partitioning_field?.stringValue
    ).toBe("");
  });

  test("masks params when the destination table name changed", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, tableName: "different_table" }
    );

    expect(request.updateMask?.paths).toEqual(["params"]);
    expect(
      request.transferConfig?.params?.fields?.destination_table_name_template
        ?.stringValue
    ).toBe('different_table_{run_time|"%H%M%S"}');
  });

  test("masks params when the query changed", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, queryString: "SELECT * FROM source.accounts" }
    );

    expect(request.updateMask?.paths).toEqual(["params"]);
    expect(request.transferConfig?.params?.fields?.query?.stringValue).toBe(
      "SELECT * FROM source.accounts"
    );
  });

  test("leaves an unset partitioning field untouched when other params change", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, queryString: "SELECT * FROM source.accounts" }
    );

    expect(
      request.transferConfig?.params?.fields?.partitioning_field?.stringValue
    ).toBe("");
  });

  test("masks the notification topic when the stored one drifted", async () => {
    const stored = unchangedTransferConfig();
    stored.notificationPubsubTopic = "projects/test-project/topics/wrong-topic";

    const request = await constructUpdateTransferConfigRequest(
      clientReturning(stored),
      TRANSFER_CONFIG_NAME,
      { ...config, schedule: "every 15 minutes" }
    );

    expect(request.updateMask?.paths).toContain("notification_pubsub_topic");
    expect(request.updateMask?.paths).toContain("schedule");
    expect(request.transferConfig?.notificationPubsubTopic).toBe(
      EXPECTED_TOPIC
    );
  });

  test("masks the destination dataset when it changed", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, datasetId: "new_dataset_id" }
    );

    expect(request.updateMask?.paths).toContain("destination_dataset_id");
    expect(request.transferConfig?.destinationDatasetId).toBe("new_dataset_id");
  });

  test("adds a partitioning field that was not previously set", async () => {
    const request = await constructUpdateTransferConfigRequest(
      clientReturning(unchangedTransferConfig()),
      TRANSFER_CONFIG_NAME,
      { ...config, partitioningField: "created_at" }
    );

    expect(request.updateMask?.paths).toEqual(["params"]);
    expect(
      request.transferConfig?.params?.fields?.partitioning_field?.stringValue
    ).toBe("created_at");
  });

  test("rejects a stored config without params.fields", async () => {
    const stored = unchangedTransferConfig();
    delete stored.params;

    await expect(
      constructUpdateTransferConfigRequest(
        clientReturning(stored),
        TRANSFER_CONFIG_NAME,
        config
      )
    ).rejects.toThrow("missing params.fields");
  });
});

describe("getTransferConfig", () => {
  test("returns the transfer config when found", async () => {
    const client = clientReturning(unchangedTransferConfig());

    const result = await getTransferConfig(client, TRANSFER_CONFIG_NAME);

    expect(result).toEqual(unchangedTransferConfig());
    expect(client.getTransferConfig).toHaveBeenCalledWith({
      name: TRANSFER_CONFIG_NAME,
    });
  });

  test("returns null on a gRPC NOT_FOUND", async () => {
    const result = await getTransferConfig(
      clientRejecting(grpcNotFound()),
      TRANSFER_CONFIG_NAME
    );

    expect(result).toBeNull();
  });

  test("rethrows any other API failure", async () => {
    await expect(
      getTransferConfig(
        clientRejecting(new Error("API Error")),
        TRANSFER_CONFIG_NAME
      )
    ).rejects.toThrow("API Error");
  });
});

describe("createTransferConfig", () => {
  test("returns the created transfer config", async () => {
    const created = { name: TRANSFER_CONFIG_NAME };
    const client = clientReturning(null);
    client.createTransferConfig.mockResolvedValue([created]);

    const result = await createTransferConfig(client, config);

    expect(result).toEqual(created);
    expect(client.createTransferConfig).toHaveBeenCalledWith(
      expect.objectContaining({ parent: "projects/test-project" })
    );
  });

  test("rejects when the API returns a config without a name", async () => {
    const client = clientReturning(null);
    client.createTransferConfig.mockResolvedValue([{}]);

    await expect(createTransferConfig(client, config)).rejects.toThrow(
      "BigQuery API returned a transfer config without a name"
    );
  });
});

describe("updateTransferConfig", () => {
  test("returns the updated transfer config", async () => {
    const updated = {
      name: TRANSFER_CONFIG_NAME,
      schedule: "every 15 minutes",
    };
    const client = clientReturning(unchangedTransferConfig());
    client.updateTransferConfig.mockResolvedValue([updated]);

    const result = await updateTransferConfig(client, TRANSFER_CONFIG_NAME, {
      ...config,
      schedule: "every 15 minutes",
    });

    expect(result).toEqual(updated);
    expect(client.updateTransferConfig).toHaveBeenCalledOnce();
  });

  test("rejects when the transfer config no longer exists", async () => {
    const client = clientReturning(null);

    await expect(
      updateTransferConfig(client, TRANSFER_CONFIG_NAME, config)
    ).rejects.toThrow("Transfer config not found");
    expect(client.updateTransferConfig).not.toHaveBeenCalled();
  });

  test("rethrows a failure from the update call", async () => {
    const client = clientReturning(unchangedTransferConfig());
    client.updateTransferConfig.mockRejectedValue(
      new Error("Update API Error")
    );

    await expect(
      updateTransferConfig(client, TRANSFER_CONFIG_NAME, config)
    ).rejects.toThrow("Update API Error");
  });
});

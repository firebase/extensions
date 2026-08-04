/*
 * Copyright 2019 Google LLC
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

import type { v1 } from "@google-cloud/bigquery-data-transfer";
import { describe, expect, test, vi } from "vitest";
import {
  PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX,
  constructUpdateTransferConfigRequest,
  createTransferConfig,
  createTransferConfigRequest,
  getTransferConfig,
  updateTransferConfig,
} from "../src/dts";
import { baseConfig, liveTransferConfig } from "./helpers";

const CONFIG_NAME = liveTransferConfig().name;

function makeFakeDtsClient(
  overrides: Partial<Record<string, unknown>> = {}
): v1.DataTransferServiceClient {
  return {
    getTransferConfig: vi.fn(async () => [liveTransferConfig()]),
    createTransferConfig: vi.fn(async () => [
      { name: "projects/test/locations/us/transferConfigs/new-config-id" },
    ]),
    updateTransferConfig: vi.fn(async () => [
      { name: "projects/test/locations/us/transferConfigs/updated-config-id" },
    ]),
    ...overrides,
  } as unknown as v1.DataTransferServiceClient;
}

describe("createTransferConfigRequest", () => {
  test("returns the correct request for the config", () => {
    const request = createTransferConfigRequest(baseConfig);

    expect(request.parent).toBe("projects/test");
    expect(request.transferConfig.dataSourceId).toBe("scheduled_query");
    expect(request.transferConfig.destinationDatasetId).toBe(
      "destination_dataset_id"
    );
    expect(request.transferConfig.displayName).toBe("Transactions Rollup");
    expect(request.transferConfig.schedule).toBe("every 15 minutes");
    expect(request.transferConfig.notificationPubsubTopic).toBe(
      "projects/test/topics/transfer_runs"
    );
    expect(request.transferConfig.params.fields).toEqual({
      query: { stringValue: baseConfig.queryString },
      destination_table_name_template: {
        stringValue: 'transactions_{run_time|"%H%M%S"}',
      },
      write_disposition: { stringValue: "WRITE_TRUNCATE" },
      partitioning_field: { stringValue: "" },
    });
    expect(request.transferConfig.serviceAccountName).toBeUndefined();
  });

  test("sets serviceAccountName when an email is provided", () => {
    const request = createTransferConfigRequest(
      baseConfig,
      "runtime-sa@test.iam.gserviceaccount.com"
    );
    expect(request.transferConfig.serviceAccountName).toBe(
      "runtime-sa@test.iam.gserviceaccount.com"
    );
  });
});

describe("constructUpdateTransferConfigRequest", () => {
  test("throws when the config is not found", async () => {
    const client = makeFakeDtsClient({
      getTransferConfig: vi.fn(async () => {
        const error = new Error("Transfer config not found");
        (error as Error & { code: number }).code = 5;
        throw error;
      }),
    });

    await expect(
      constructUpdateTransferConfigRequest(client, CONFIG_NAME, baseConfig)
    ).rejects.toThrow("Transfer config not found");
  });

  test("no change produces an empty update mask", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      baseConfig
    );
    expect(request.updateMask.paths).toEqual([]);
  });

  test("schedule change masks schedule only", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, schedule: "every 30 minutes" }
    );
    expect(request.updateMask.paths).toEqual(["schedule"]);
    expect(request.transferConfig.schedule).toBe("every 30 minutes");
  });

  test("table name change masks params", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, tableName: "transactions_v2" }
    );
    expect(request.updateMask.paths).toEqual(["params"]);
    expect(
      request.transferConfig.params.fields.destination_table_name_template
        .stringValue
    ).toBe('transactions_v2_{run_time|"%H%M%S"}');
  });

  test("query change masks params", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, queryString: "SELECT 1" }
    );
    expect(request.updateMask.paths).toEqual(["params"]);
    expect(request.transferConfig.params.fields.query.stringValue).toBe(
      "SELECT 1"
    );
  });

  test("empty partitioning field does not add params mask when only schedule changes", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, schedule: "every hour" }
    );
    expect(request.updateMask.paths).toEqual(["schedule"]);
  });

  test("adding a partitioning field masks params", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, partitioningField: "created_at" }
    );
    expect(request.updateMask.paths).toContain("params");
    expect(
      request.transferConfig.params.fields.partitioning_field.stringValue
    ).toBe("created_at");
  });

  test("dataset change masks destination_dataset_id", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, datasetId: "other_dataset" }
    );
    expect(request.updateMask.paths).toEqual(["destination_dataset_id"]);
    expect(request.transferConfig.destinationDatasetId).toBe("other_dataset");
  });

  test("topic mismatch masks notification_pubsub_topic", async () => {
    const request = await constructUpdateTransferConfigRequest(
      makeFakeDtsClient(),
      CONFIG_NAME,
      { ...baseConfig, pubsubTopic: "other_topic" }
    );
    expect(request.updateMask.paths).toEqual(["notification_pubsub_topic"]);
    expect(request.transferConfig.notificationPubsubTopic).toBe(
      "projects/test/topics/other_topic"
    );
  });

  test("clearing a non-empty partitioning field throws the removal error", async () => {
    const existing = liveTransferConfig();
    existing.params.fields.partitioning_field.stringValue = "created_at";
    const client = makeFakeDtsClient({
      getTransferConfig: vi.fn(async () => [existing]),
    });

    await expect(
      constructUpdateTransferConfigRequest(client, CONFIG_NAME, baseConfig)
    ).rejects.toThrow(PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX);
  });
});

describe("getTransferConfig", () => {
  test("returns the transfer config when found", async () => {
    const result = await getTransferConfig(makeFakeDtsClient(), CONFIG_NAME);
    expect(result?.name).toBe(CONFIG_NAME);
  });

  test("returns null on gRPC NOT_FOUND", async () => {
    const client = makeFakeDtsClient({
      getTransferConfig: vi.fn(async () => {
        const error = new Error("not found");
        (error as Error & { code: number }).code = 5;
        throw error;
      }),
    });
    expect(await getTransferConfig(client, CONFIG_NAME)).toBeNull();
  });

  test("rethrows non-NOT_FOUND errors", async () => {
    const client = makeFakeDtsClient({
      getTransferConfig: vi.fn(async () => {
        throw new Error("API Error");
      }),
    });
    await expect(getTransferConfig(client, CONFIG_NAME)).rejects.toThrow(
      "API Error"
    );
  });
});

describe("createTransferConfig", () => {
  test("creates and returns the config", async () => {
    const client = makeFakeDtsClient();
    const created = await createTransferConfig(client, baseConfig);
    expect(created.name).toBe(
      "projects/test/locations/us/transferConfigs/new-config-id"
    );
  });

  test("throws when the API returns a config without a name", async () => {
    const client = makeFakeDtsClient({
      createTransferConfig: vi.fn(async () => [{}]),
    });
    await expect(createTransferConfig(client, baseConfig)).rejects.toThrow(
      "without a name"
    );
  });
});

describe("updateTransferConfig", () => {
  test("updates and returns the config", async () => {
    const client = makeFakeDtsClient();
    const updated = await updateTransferConfig(client, CONFIG_NAME, {
      ...baseConfig,
      schedule: "every hour",
    });
    expect(updated.name).toBe(
      "projects/test/locations/us/transferConfigs/updated-config-id"
    );
  });

  test("propagates API errors", async () => {
    const client = makeFakeDtsClient({
      updateTransferConfig: vi.fn(async () => {
        throw new Error("API Error");
      }),
    });
    await expect(
      updateTransferConfig(client, CONFIG_NAME, {
        ...baseConfig,
        schedule: "every hour",
      })
    ).rejects.toThrow("API Error");
  });
});

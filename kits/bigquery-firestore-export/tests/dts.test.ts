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
  createTransferConfigRequest,
  type DataTransferClient,
  PARTITIONING_FIELD_REMOVAL_ERROR,
} from "../src/dts";
import { PermanentConfigurationError } from "../src/errors";
import { resolveConfig } from "../src/export-config";

const config = resolveConfig({
  bigqueryDatasetLocation: "US",
  projectId: "test-project",
  instanceId: "users-export",
  datasetId: "analytics",
  tableName: "users",
  queryString: "SELECT * FROM source.users",
  displayName: "Users export",
  partitioningField: "created_at",
  schedule: "every 24 hours",
});

function clientWithTransferConfig(transferConfig: object): DataTransferClient {
  return {
    getTransferConfig: vi.fn().mockResolvedValue([transferConfig]),
  } as unknown as DataTransferClient;
}

describe("createTransferConfigRequest", () => {
  test("creates the scheduled-query request", () => {
    const request = createTransferConfigRequest(
      config,
      "runtime@test-project.iam.gserviceaccount.com"
    );

    expect(request).toMatchObject({
      parent: "projects/test-project",
      transferConfig: {
        destinationDatasetId: "analytics",
        displayName: "Users export",
        dataSourceId: "scheduled_query",
        schedule: "every 24 hours",
        notificationPubsubTopic:
          "projects/test-project/topics/kit-users-export-processMessages",
        serviceAccountName: "runtime@test-project.iam.gserviceaccount.com",
      },
    });
    expect(
      request.transferConfig?.params?.fields?.destination_table_name_template
        ?.stringValue
    ).toBe('users_{run_time|"%H%M%S"}');
  });
});

describe("constructUpdateTransferConfigRequest", () => {
  test("deduplicates the params update mask", async () => {
    const client = clientWithTransferConfig({
      name: "projects/p/locations/us/transferConfigs/c",
      destinationDatasetId: "analytics",
      schedule: "every 24 hours",
      notificationPubsubTopic:
        "projects/test-project/topics/kit-users-export-processMessages",
      params: {
        fields: {
          query: { stringValue: "SELECT 1" },
          destination_table_name_template: {
            stringValue: 'old_{run_time|"%H%M%S"}',
          },
          partitioning_field: { stringValue: "created_at" },
        },
      },
    });

    const request = await constructUpdateTransferConfigRequest(
      client,
      "projects/p/locations/us/transferConfigs/c",
      config
    );

    expect(request.updateMask?.paths).toEqual(["params"]);
  });

  test("rejects clearing an existing partitioning field", async () => {
    const client = clientWithTransferConfig({
      name: "projects/p/locations/us/transferConfigs/c",
      destinationDatasetId: "analytics",
      schedule: "every 24 hours",
      notificationPubsubTopic:
        "projects/test-project/topics/kit-users-export-processMessages",
      params: {
        fields: {
          query: { stringValue: config.queryString },
          destination_table_name_template: {
            stringValue: 'users_{run_time|"%H%M%S"}',
          },
          partitioning_field: { stringValue: "created_at" },
        },
      },
    });

    await expect(
      constructUpdateTransferConfigRequest(
        client,
        "projects/p/locations/us/transferConfigs/c",
        { ...config, partitioningField: undefined }
      )
    ).rejects.toThrow(PARTITIONING_FIELD_REMOVAL_ERROR);

    await expect(
      constructUpdateTransferConfigRequest(
        client,
        "projects/p/locations/us/transferConfigs/c",
        { ...config, partitioningField: undefined }
      )
    ).rejects.toBeInstanceOf(PermanentConfigurationError);
  });

  test.for([
    ["missing params.fields", {}],
    [
      "missing params.fields.query",
      { params: { fields: { destination_table_name_template: {} } } },
    ],
    [
      "missing params.fields.destination_table_name_template",
      { params: { fields: { query: { stringValue: "SELECT 1" } } } },
    ],
  ] as const)(
    "reports a config the kit cannot update as permanent: %s",
    async ([expectedMessage, shape]) => {
      const client = clientWithTransferConfig({
        name: "projects/p/locations/us/transferConfigs/c",
        ...shape,
      });

      const rejects = expect(
        constructUpdateTransferConfigRequest(
          client,
          "projects/p/locations/us/transferConfigs/c",
          config
        )
      ).rejects;

      await rejects.toBeInstanceOf(PermanentConfigurationError);
      await rejects.toThrow(
        `Transfer config has invalid structure: ${expectedMessage}`
      );
      await rejects.toThrow("Only scheduled queries are supported");
    }
  );

  test("reports a vanished transfer config as permanent", async () => {
    const notFound = Object.assign(new Error("5 NOT_FOUND"), { code: 5 });
    const client = {
      getTransferConfig: vi.fn().mockRejectedValue(notFound),
    } as unknown as DataTransferClient;

    await expect(
      constructUpdateTransferConfigRequest(
        client,
        "projects/p/locations/us/transferConfigs/gone",
        config
      )
    ).rejects.toThrow(PermanentConfigurationError);
  });
});

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
  updateNotificationTopic,
} from "../src/dts";
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
  });
});

describe("updateNotificationTopic", () => {
  const linked = {
    name: "projects/p/locations/us/transferConfigs/c",
    destinationDatasetId: "adopted_dataset",
    schedule: "every 6 hours",
    params: {
      fields: {
        query: { stringValue: "SELECT * FROM adopted.rows" },
        destination_table_name_template: {
          stringValue: 'adopted_{run_time|"%H%M%S"}',
        },
      },
    },
  };

  test("updates only the notification topic when it differs", async () => {
    const updateTransferConfig = vi
      .fn()
      .mockResolvedValue([{ ...linked, notificationPubsubTopic: "updated" }]);
    const client = {
      updateTransferConfig,
    } as unknown as DataTransferClient;

    const updated = await updateNotificationTopic(
      client,
      { ...linked, notificationPubsubTopic: "projects/p/topics/ext-old-topic" },
      config
    );

    const request = updateTransferConfig.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual(["notification_pubsub_topic"]);
    expect(request.transferConfig.notificationPubsubTopic).toBe(
      "projects/test-project/topics/kit-users-export-processMessages"
    );
    expect(request.transferConfig.name).toBe(linked.name);
    expect(request.transferConfig.destinationDatasetId).toBeFalsy();
    expect(request.transferConfig.schedule).toBeFalsy();
    expect(request.transferConfig.params).toBeFalsy();
    expect(updated.notificationPubsubTopic).toBe("updated");
  });

  test("leaves a config already notifying this instance untouched", async () => {
    const updateTransferConfig = vi.fn();
    const client = {
      updateTransferConfig,
    } as unknown as DataTransferClient;
    const alreadyLinked = {
      ...linked,
      notificationPubsubTopic:
        "projects/test-project/topics/kit-users-export-processMessages",
    };

    const returned = await updateNotificationTopic(
      client,
      alreadyLinked,
      config
    );

    expect(updateTransferConfig).not.toHaveBeenCalled();
    expect(returned).toBe(alreadyLinked);
  });
});

/*
 * Copyright 2025 Google LLC
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

import * as bigqueryDataTransfer from "@google-cloud/bigquery-data-transfer";
import type { ResolvedBigqueryFirestoreExportConfig } from "./export-config";
import * as logs from "./logs";

export type DataTransferClient =
  bigqueryDataTransfer.v1.DataTransferServiceClient;
export type TransferConfig =
  bigqueryDataTransfer.protos.google.cloud.bigquery.datatransfer.v1.ITransferConfig;

const GRPC_NOT_FOUND = 5;
const PACKAGE_PARTITIONING_ERROR =
  "Cannot remove partitioning_field from an existing transfer config";

export const PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX =
  PACKAGE_PARTITIONING_ERROR;
export const PARTITIONING_FIELD_REMOVAL_ERROR = `${PACKAGE_PARTITIONING_ERROR}. The BigQuery Data Transfer API does not support clearing this parameter once it has been set. To change partitioning, create a new transfer config with the desired setting.`;

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === GRPC_NOT_FOUND
  );
}

function transferConfigFields(config: TransferConfig) {
  const fields = config.params?.fields;
  if (!fields) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields"
    );
  }
  if (!fields.query) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields.query"
    );
  }
  if (!fields.destination_table_name_template) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields.destination_table_name_template"
    );
  }

  return fields;
}

function stringField(value: string | undefined): { stringValue: string } {
  return { stringValue: value ?? "" };
}

/** Creates the protobuf-shaped request used for a scheduled query. */
export function createTransferConfigRequest(
  config: ResolvedBigqueryFirestoreExportConfig,
  serviceAccountEmail?: string
): bigqueryDataTransfer.protos.google.cloud.bigquery.datatransfer.v1.ICreateTransferConfigRequest {
  return {
    parent: `projects/${config.projectId}`,
    transferConfig: {
      destinationDatasetId: config.datasetId,
      displayName: config.displayName,
      dataSourceId: "scheduled_query",
      params: {
        fields: {
          query: stringField(config.queryString),
          destination_table_name_template: stringField(
            `${config.tableName}_{run_time|"%H%M%S"}`
          ),
          write_disposition: stringField("WRITE_TRUNCATE"),
          partitioning_field: stringField(config.partitioningField),
        },
      },
      schedule: config.schedule,
      notificationPubsubTopic: `projects/${config.projectId}/topics/${config.pubSubTopic}`,
      ...(serviceAccountEmail
        ? { serviceAccountName: serviceAccountEmail }
        : {}),
    },
  };
}

export async function getTransferConfig(
  client: DataTransferClient,
  transferConfigName: string
): Promise<TransferConfig | null> {
  try {
    const [config] = await client.getTransferConfig({
      name: transferConfigName,
    });
    return config;
  } catch (err) {
    if (isNotFoundError(err)) {
      logs.transferConfigNotFound(transferConfigName);
      return null;
    }
    logs.getTransferConfigFailed(transferConfigName, err);
    throw err;
  }
}

export async function createTransferConfig(
  client: DataTransferClient,
  config: ResolvedBigqueryFirestoreExportConfig
): Promise<TransferConfig> {
  logs.createTransferConfig();
  const [created] = await client.createTransferConfig(
    createTransferConfigRequest(config, config.serviceAccount)
  );
  if (!created.name) {
    throw new Error("BigQuery API returned a transfer config without a name");
  }
  logs.transferConfigCreated(created.name);
  return created;
}

/** Builds a minimal update mask while retaining unsupported immutable fields. */
export async function constructUpdateTransferConfigRequest(
  client: DataTransferClient,
  transferConfigName: string,
  config: ResolvedBigqueryFirestoreExportConfig
): Promise<bigqueryDataTransfer.protos.google.cloud.bigquery.datatransfer.v1.IUpdateTransferConfigRequest> {
  const transferConfig = await getTransferConfig(client, transferConfigName);
  if (!transferConfig) throw new Error("Transfer config not found");

  const fields = transferConfigFields(transferConfig);
  const updatedConfig = JSON.parse(
    JSON.stringify(transferConfig)
  ) as TransferConfig;
  const updatedFields = transferConfigFields(updatedConfig);
  const updateMask: string[] = [];

  if (config.datasetId !== transferConfig.destinationDatasetId) {
    updateMask.push("destination_dataset_id");
    updatedConfig.destinationDatasetId = config.datasetId;
  }
  if (config.queryString !== fields.query.stringValue) {
    updateMask.push("params");
    updatedFields.query.stringValue = config.queryString;
  }

  const tableTemplate = `${config.tableName}_{run_time|"%H%M%S"}`;
  if (tableTemplate !== fields.destination_table_name_template.stringValue) {
    updateMask.push("params");
    updatedFields.destination_table_name_template.stringValue = tableTemplate;
  }

  const existingPartitioningField =
    fields.partitioning_field?.stringValue ?? "";
  const newPartitioningField = config.partitioningField ?? "";
  if (newPartitioningField !== existingPartitioningField) {
    if (!newPartitioningField) {
      logs.partitioningFieldRemovalAttempted(
        transferConfigName,
        existingPartitioningField
      );
      throw new Error(PARTITIONING_FIELD_REMOVAL_ERROR);
    }
    updateMask.push("params");
    updatedFields.partitioning_field ??= {};
    updatedFields.partitioning_field.stringValue = newPartitioningField;
  }

  if (config.schedule !== transferConfig.schedule) {
    updateMask.push("schedule");
    updatedConfig.schedule = config.schedule;
  }

  const expectedTopic = `projects/${config.projectId}/topics/${config.pubSubTopic}`;
  if (expectedTopic !== transferConfig.notificationPubsubTopic) {
    updateMask.push("notification_pubsub_topic");
    updatedConfig.notificationPubsubTopic = expectedTopic;
  }

  return {
    transferConfig: updatedConfig,
    updateMask: { paths: [...new Set(updateMask)] },
  };
}

export async function updateTransferConfig(
  client: DataTransferClient,
  transferConfigName: string,
  config: ResolvedBigqueryFirestoreExportConfig
): Promise<TransferConfig> {
  const request = await constructUpdateTransferConfigRequest(
    client,
    transferConfigName,
    config
  );
  logs.updateTransferConfig(transferConfigName);
  const converted =
    bigqueryDataTransfer.protos.google.cloud.bigquery.datatransfer.v1.UpdateTransferConfigRequest.fromObject(
      request
    );
  const [updated] = await client.updateTransferConfig(converted);
  logs.transferConfigUpdated(transferConfigName);
  return updated;
}

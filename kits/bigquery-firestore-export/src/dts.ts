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

import type { protos, v1 } from "@google-cloud/bigquery-data-transfer";
import { protos as dtsProtos } from "@google-cloud/bigquery-data-transfer";
import type { ResolvedExportConfig } from "./export-config";
import { topicResourceName } from "./export-config";
import * as logs from "./logs";

type ITransferConfig =
  protos.google.cloud.bigquery.datatransfer.v1.ITransferConfig;

/** gRPC status code for NOT_FOUND. */
const GRPC_NOT_FOUND = 5;

export const PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX =
  "Cannot remove partitioning_field from an existing transfer config";

export const PARTITIONING_FIELD_REMOVAL_ERROR =
  "Cannot remove partitioning_field from an existing transfer config. The BigQuery Data Transfer API does not support clearing this parameter once it has been set. To change partitioning, you must create a new transfer config with the desired partitioning settings.";

/** Parsed components from a transfer run resource name. */
export interface ParsedTransferRunName {
  projectId: string;
  location: string;
  transferConfigId: string;
  runId: string;
}

/** Parsed components from a transfer config resource name. */
export interface ParsedTransferConfigName {
  projectId: string;
  location: string;
  transferConfigId: string;
}

const TRANSFER_RUN_NAME_REGEX =
  /^projects\/([^/]+)\/locations\/([^/]+)\/transferConfigs\/([^/]+)\/runs\/([^/]+)$/;

const TRANSFER_CONFIG_NAME_REGEX =
  /^projects\/([^/]+)\/locations\/([^/]+)\/transferConfigs\/([^/]+)$/;

/**
 * Parses a transfer run resource name into its components.
 *
 * @param name - `projects/{p}/locations/{l}/transferConfigs/{c}/runs/{r}`.
 * @returns The parsed components.
 * @throws If the name does not match the expected format.
 */
export function parseTransferRunName(name: string): ParsedTransferRunName {
  const match = name.match(TRANSFER_RUN_NAME_REGEX);
  if (!match) {
    throw new Error(
      `Invalid transfer run name format: "${name}". Expected format: projects/{projectId}/locations/{location}/transferConfigs/{configId}/runs/{runId}`
    );
  }
  return {
    projectId: match[1],
    location: match[2],
    transferConfigId: match[3],
    runId: match[4],
  };
}

/**
 * Parses a transfer config resource name into its components.
 *
 * @param name - `projects/{p}/locations/{l}/transferConfigs/{c}`.
 * @returns The parsed components.
 * @throws If the name does not match the expected format.
 */
export function parseTransferConfigName(
  name: string
): ParsedTransferConfigName {
  const match = name.match(TRANSFER_CONFIG_NAME_REGEX);
  if (!match) {
    throw new Error(
      `Invalid transfer config name format: "${name}". Expected format: projects/{projectId}/locations/{location}/transferConfigs/{configId}`
    );
  }
  return {
    projectId: match[1],
    location: match[2],
    transferConfigId: match[3],
  };
}

function isNotFoundError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    e.code === GRPC_NOT_FOUND
  );
}

function validateTransferConfigStructure(
  transferConfig: ITransferConfig
): void {
  if (!transferConfig.params?.fields) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields"
    );
  }
  if (!transferConfig.params.fields.query) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields.query"
    );
  }
  if (!transferConfig.params.fields.destination_table_name_template) {
    throw new Error(
      "Transfer config has invalid structure: missing params.fields.destination_table_name_template"
    );
  }
}

function toTransferParams(
  params: Record<string, string | number | boolean>
): Record<string, object> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      switch (typeof value) {
        case "boolean":
          return [key, { boolValue: value }];
        case "number":
          return [key, { numberValue: value }];
        case "string":
          return [key, { stringValue: value }];
        default: {
          const error = new Error(
            `not implemented transfer config parameter type ${typeof value}`
          );
          logs.error(error);
          throw error;
        }
      }
    })
  );
}

function destinationTableNameTemplate(config: ResolvedExportConfig): string {
  return `${config.tableName}_{run_time|"%H%M%S"}`;
}

/**
 * Retrieves a transfer config by name.
 *
 * @param client - The DTS client.
 * @param transferConfigName - Full resource name of the transfer config.
 * @returns The transfer config, or `null` if not found.
 * @throws If the API call fails for reasons other than NOT_FOUND.
 */
export async function getTransferConfig(
  client: v1.DataTransferServiceClient,
  transferConfigName: string
): Promise<ITransferConfig | null> {
  try {
    const response = await client.getTransferConfig({
      name: transferConfigName,
    });
    return response[0];
  } catch (e) {
    if (isNotFoundError(e)) {
      logs.transferConfigNotFound(transferConfigName);
      return null;
    }
    logs.getTransferConfigFailed(
      transferConfigName,
      e instanceof Error ? e : new Error(String(e))
    );
    throw e;
  }
}

/**
 * Builds the CreateTransferConfig request for the configured scheduled query.
 *
 * @param config - The resolved configuration.
 * @param serviceAccountEmail - Service account the transfer runs as
 *   (creation-only; cannot be changed on update).
 * @returns The request object.
 */
export function createTransferConfigRequest(
  config: ResolvedExportConfig,
  serviceAccountEmail?: string
) {
  const transferConfigParams = toTransferParams({
    query: config.queryString,
    destination_table_name_template: destinationTableNameTemplate(config),
    write_disposition: "WRITE_TRUNCATE",
    partitioning_field: config.partitioningField || "",
  });

  const transferConfig: ITransferConfig = {
    destinationDatasetId: config.datasetId,
    displayName: config.displayName,
    dataSourceId: "scheduled_query",
    params: { fields: transferConfigParams },
    schedule: config.schedule,
    notificationPubsubTopic: topicResourceName(config),
    ...(serviceAccountEmail && { serviceAccountName: serviceAccountEmail }),
  };

  return {
    parent: `projects/${config.projectId}`,
    transferConfig,
  };
}

/**
 * Creates the DTS scheduled-query transfer config.
 *
 * @param client - The DTS client.
 * @param config - The resolved configuration.
 * @param serviceAccountEmail - Service account the transfer runs as.
 * @returns The created transfer config (guaranteed to have a name).
 */
export async function createTransferConfig(
  client: v1.DataTransferServiceClient,
  config: ResolvedExportConfig,
  serviceAccountEmail?: string
): Promise<ITransferConfig> {
  const request = createTransferConfigRequest(config, serviceAccountEmail);

  logs.createTransferConfig();
  const response = await client.createTransferConfig(request);
  const createdConfig = response[0];

  if (!createdConfig.name) {
    throw new Error(
      "BigQuery API returned transfer config without a name - this is unexpected"
    );
  }

  logs.transferConfigCreated(createdConfig.name);
  return createdConfig;
}

/**
 * Diffs the live transfer config against the desired configuration and builds
 * an update request with the minimal updateMask.
 *
 * @param client - The DTS client.
 * @param transferConfigName - Full resource name of the existing config.
 * @param config - The resolved configuration.
 * @returns The update request.
 * @throws PARTITIONING_FIELD_REMOVAL_ERROR when the update would clear a
 *   previously-set partitioning field (unsupported by the DTS API).
 */
export async function constructUpdateTransferConfigRequest(
  client: v1.DataTransferServiceClient,
  transferConfigName: string,
  config: ResolvedExportConfig
) {
  const transferConfig = await getTransferConfig(client, transferConfigName);

  if (!transferConfig) {
    throw new Error("Transfer config not found");
  }

  validateTransferConfigStructure(transferConfig);

  const fields = transferConfig.params!.fields!;

  const updateMask: string[] = [];
  const updatedConfig = JSON.parse(JSON.stringify(transferConfig));

  if (config.datasetId !== transferConfig.destinationDatasetId) {
    updateMask.push("destination_dataset_id");
    updatedConfig.destinationDatasetId = config.datasetId;
  }

  if (config.queryString !== fields.query.stringValue) {
    updateMask.push("params");
    updatedConfig.params.fields.query.stringValue = config.queryString;
  }

  const tableTemplate = destinationTableNameTemplate(config);
  if (tableTemplate !== fields.destination_table_name_template.stringValue) {
    updateMask.push("params");
    updatedConfig.params.fields.destination_table_name_template.stringValue =
      tableTemplate;
  }

  // The DTS API rejects empty values for partitioning_field on update, and
  // cannot clear the field once set - hence the asymmetric handling below.
  const existingPartitioningField =
    fields.partitioning_field?.stringValue || "";
  const newPartitioningField = config.partitioningField || "";

  if (newPartitioningField !== existingPartitioningField) {
    if (newPartitioningField) {
      updateMask.push("params");
      if (!updatedConfig.params.fields.partitioning_field) {
        updatedConfig.params.fields.partitioning_field = {};
      }
      updatedConfig.params.fields.partitioning_field.stringValue =
        newPartitioningField;
    } else {
      logs.partitioningFieldRemovalAttempted(
        transferConfigName,
        existingPartitioningField
      );
      throw new Error(PARTITIONING_FIELD_REMOVAL_ERROR);
    }
  }

  if (config.schedule !== transferConfig.schedule) {
    updateMask.push("schedule");
    updatedConfig.schedule = config.schedule;
  }

  const expectedPubsubTopic = topicResourceName(config);
  if (expectedPubsubTopic !== transferConfig.notificationPubsubTopic) {
    updateMask.push("notification_pubsub_topic");
    updatedConfig.notificationPubsubTopic = expectedPubsubTopic;
  }

  // serviceAccountName is creation-only and never part of the update mask.

  return {
    transferConfig: updatedConfig,
    updateMask: { paths: updateMask },
    name: transferConfig.name,
  };
}

/**
 * Updates the existing DTS transfer config to match the configuration.
 *
 * @param client - The DTS client.
 * @param transferConfigName - Full resource name of the existing config.
 * @param config - The resolved configuration.
 * @returns The updated transfer config.
 */
export async function updateTransferConfig(
  client: v1.DataTransferServiceClient,
  transferConfigName: string,
  config: ResolvedExportConfig
): Promise<ITransferConfig> {
  try {
    const request = await constructUpdateTransferConfigRequest(
      client,
      transferConfigName,
      config
    );

    logs.updateTransferConfig(transferConfigName);
    const converted =
      dtsProtos.google.cloud.bigquery.datatransfer.v1.UpdateTransferConfigRequest.fromObject(
        request
      );

    const response = await client.updateTransferConfig(converted);
    logs.transferConfigUpdated(transferConfigName);
    return response[0];
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes(PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX)
    ) {
      throw e;
    }
    logs.error(e instanceof Error ? e : new Error(String(e)));
    throw e;
  }
}

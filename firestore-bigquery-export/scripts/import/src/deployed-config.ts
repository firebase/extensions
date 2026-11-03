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

import { Dataset } from "@google-cloud/bigquery";
import { CliConfig, ViewType } from "./types";

export interface DeployedConfig {
  viewType: ViewType;
  clustering?: string[];
  errors: string[];
}

async function getMetadataIfExists(dataset: Dataset, tableName: string) {
  const table = dataset.table(tableName);
  const [exists] = await table.exists();
  if (!exists) return undefined;
  const [metadata] = await table.getMetadata();
  return metadata;
}

/**
 * Reads the view type and clustering from the tables the extension already
 * created, because the tracker rewrites both to match its config: a mismatched
 * view type deletes or fails on the latest view, and missing clustering
 * removes it from the changelog table.
 */
export async function resolveDeployedConfig(
  dataset: Dataset,
  config: Pick<
    CliConfig,
    "tableId" | "rawChangeLogName" | "viewType" | "clustering"
  >
): Promise<DeployedConfig> {
  const errors: string[] = [];

  const latestName = `${config.tableId}_raw_latest`;
  const latest = await getMetadataIfExists(dataset, latestName);
  let deployedViewType: ViewType | undefined;
  if (latest) {
    if (latest.type === "MATERIALIZED_VIEW") {
      deployedViewType = latest.materializedView?.allowNonIncrementalDefinition
        ? "materialized_non_incremental"
        : "materialized_incremental";
    } else {
      deployedViewType = "view";
    }
  }

  if (
    deployedViewType &&
    config.viewType &&
    config.viewType !== deployedViewType
  ) {
    errors.push(
      `--view-type is ${config.viewType}, but ${latestName} is ${deployedViewType}. ` +
        `Omit --view-type to use the deployed view type.`
    );
  }

  const changelog = await getMetadataIfExists(dataset, config.rawChangeLogName);
  const deployedClustering: string[] | undefined = changelog
    ? changelog.clustering?.fields ?? []
    : undefined;

  if (
    deployedClustering &&
    config.clustering &&
    config.clustering.join(",") !== deployedClustering.join(",")
  ) {
    errors.push(
      `--clustering is "${config.clustering.join(",")}", but ` +
        `${config.rawChangeLogName} is clustered on "${deployedClustering.join(
          ","
        )}". ` +
        `Omit --clustering to keep the deployed clustering.`
    );
  }

  return {
    viewType: deployedViewType ?? config.viewType ?? "view",
    clustering: deployedClustering ?? config.clustering ?? undefined,
    errors,
  };
}

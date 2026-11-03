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

import { BigQuery, Table, TableMetadata } from "@google-cloud/bigquery";
import { ChangeTrackerConfig } from ".";
import * as logs from "../logs";
import {
  buildMaterializedViewQuery,
  buildNonIncrementalMaterializedViewQuery,
} from "./snapshot";
import { logger } from "firebase-functions";
import * as sqlFormatter from "sql-formatter";

interface InitializeLatestMaterializedViewOptions {
  bq: BigQuery;
  changeTrackerConfig: ChangeTrackerConfig;
  view: Table;
  viewExists: boolean;
  rawChangeLogTableName: string;
  rawLatestViewName: string;
  schema?: any;
}

export async function shouldRecreateMaterializedView(
  view: Table,
  config: ChangeTrackerConfig,
  source: string
): Promise<boolean> {
  const [viewMetadata] = await view.getMetadata();

  const isIncremental = !(viewMetadata as TableMetadata).materializedView
    ?.allowNonIncrementalDefinition;

  const incrementalMatch =
    isIncremental === !!config.useIncrementalMaterializedView;

  const viewQuery =
    (viewMetadata as TableMetadata).materializedView?.query || "";

  const queryMatch =
    sqlFormatter.format(viewQuery) === sqlFormatter.format(source);

  return !queryMatch || !incrementalMatch;
}

/**
 * Creates the latest materialized view.
 */
export async function initializeLatestMaterializedView({
  bq,
  changeTrackerConfig: config,
  view,
  viewExists,
  rawChangeLogTableName,
  rawLatestViewName,
  schema,
}: InitializeLatestMaterializedViewOptions): Promise<Table> {
  try {
    const { query, source } = config.useIncrementalMaterializedView
      ? buildMaterializedViewQuery({
          projectId: bq.projectId,
          datasetId: config.datasetId,
          tableName: rawChangeLogTableName,
          rawLatestViewName,
          schema,
        })
      : buildNonIncrementalMaterializedViewQuery({
          projectId: bq.projectId,
          datasetId: config.datasetId,
          tableName: rawChangeLogTableName,
          maxStaleness: config.maxStaleness,
          refreshIntervalMinutes: config.refreshIntervalMinutes,
          rawLatestViewName,
          enableRefresh: true,
          schema,
        });

    const desiredQuery = sqlFormatter.format(query);

    if (viewExists) {
      const shouldRecreate = await shouldRecreateMaterializedView(
        view,
        config,
        source
      );

      if (!shouldRecreate) {
        logger.warn(
          `Materialized view requested, but a view with matching configuration exists. Skipping creation.`
        );
        return view;
      }

      logger.warn(
        `Configuration mismatch detected for ${rawLatestViewName} ` +
          `Recreating view...`
      );

      await view.delete();

      return await initializeLatestMaterializedView({
        bq,
        changeTrackerConfig: config,
        view,
        viewExists: false,
        rawChangeLogTableName,
        rawLatestViewName,
        schema,
      });
    }

    logs.bigQueryViewCreating(rawLatestViewName, desiredQuery);
    await bq.query(desiredQuery);

    logs.bigQueryViewCreated(rawLatestViewName);
  } catch (error) {
    logs.tableCreationError(rawLatestViewName, error.message);
    throw error;
  }

  return view;
}

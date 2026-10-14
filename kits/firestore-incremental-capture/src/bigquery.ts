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

import { BigQuery } from "@google-cloud/bigquery";
import type { ResolvedCaptureConfig } from "./capture-config";
import { CHANGELOG_SCHEMA, type ChangelogRow } from "./changelog";
import * as logs from "./logs";

/**
 * BigQuery access for the changelog table.
 */
export class ChangelogTable {
  private readonly bq: BigQuery;

  /**
   * @param config - The resolved capture configuration.
   * @param bq - BigQuery client, injectable for tests.
   */
  constructor(
    private readonly config: ResolvedCaptureConfig,
    bq: BigQuery = new BigQuery({ projectId: config.projectId })
  ) {
    this.bq = bq;
  }

  /**
   * Creates the changelog dataset and table if they do not already exist.
   *
   * Safe to call repeatedly: it is the provisioning path for both first deploy
   * and redeploy, and existing resources are left untouched.
   */
  async initialize(): Promise<void> {
    const { datasetId, tableId, datasetLocation } = this.config;
    const dataset = this.bq.dataset(datasetId, { location: datasetLocation });
    const [datasetExists] = await dataset.exists();

    if (datasetExists) {
      logs.info(`BigQuery dataset already exists: ${datasetId}`);
    } else {
      logs.debug(`Creating BigQuery dataset: ${datasetId}`);
      await this.bq.createDataset(datasetId, { location: datasetLocation });
      logs.info(`Created BigQuery dataset: ${datasetId}`);
    }

    const table = dataset.table(tableId);
    const [tableExists] = await table.exists();

    if (tableExists) {
      logs.info(`BigQuery table already exists: ${tableId}`);
      return;
    }

    logs.debug(`Creating BigQuery table: ${tableId}`);
    await dataset.createTable(tableId, {
      schema: [...CHANGELOG_SCHEMA],
      location: datasetLocation,
    });
    logs.info(`Created BigQuery table: ${tableId}`);
  }

  /**
   * Inserts changelog rows.
   *
   * @param rows - The rows to insert.
   * @throws The underlying insert error. Callers run on a task queue and rely
   *   on the rejection to trigger a retry.
   */
  async insert(rows: ChangelogRow[]): Promise<void> {
    const { datasetId, tableId } = this.config;

    try {
      await this.bq.dataset(datasetId).table(tableId).insert(rows);
    } catch (err) {
      logs.error(`Failed to insert ${rows.length} changelog row(s)`, err);
      throw err;
    }
  }
}

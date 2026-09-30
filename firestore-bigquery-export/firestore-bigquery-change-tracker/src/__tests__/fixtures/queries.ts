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

import { BigQuery } from "@google-cloud/bigquery";

export const defaultQuery = (
  bqProjectId: string,
  datasetId: string,
  tableId: string
): string => `SELECT *
      FROM \`${bqProjectId}.${datasetId}.${tableId}\`
      LIMIT 1`;

export const getBigQueryTableData = async (bqProjectId, datasetId, tableId) => {
  const bq = new BigQuery({ projectId: bqProjectId });

  // Setup queries
  const [changeLogQuery] = await bq.createQueryJob({
    query: defaultQuery(bqProjectId, datasetId, `${tableId}_raw_changelog`),
  });

  const [latestViewQuery] = await bq.createQueryJob({
    query: defaultQuery(bqProjectId, datasetId, `${tableId}_raw_latest`),
  });

  // // Wait for the queries to finish
  const [changeLogRows] = await changeLogQuery.getQueryResults();
  const [latestRows] = await latestViewQuery.getQueryResults();

  return [changeLogRows, latestRows];
};

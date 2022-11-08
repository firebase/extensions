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

import * as sqlFormatter from "sql-formatter";

import { timestampField } from "./schema";

const excludeFields: string[] = ["document_name", "document_id"];

export const latestConsistentSnapshotView = (
  datasetId: string,
  tableName: string,
  schema: any,
  bqProjectId?: string
) => ({
  query: buildLatestSnapshotViewQuery(
    datasetId,
    tableName,
    timestampField.name,
    schema["fields"]
      .map((field) => field.name)
      .filter((name) => excludeFields.indexOf(name) === -1),
    bqProjectId
  ),
  useLegacySql: false,
});

export function buildLatestSnapshotViewQuery(
  datasetId: string,
  tableName: string,
  timestampColumnName: string,
  groupByColumns: string[],
  bqProjectId?: string
): string {
  if (datasetId === "" || tableName === "" || timestampColumnName === "") {
    throw Error(`Missing some query parameters!`);
  }
  for (let columnName in groupByColumns) {
    if (columnName === "") {
      throw Error(`Found empty group by column!`);
    }
  }
  const query =
    sqlFormatter.format(` -- Retrieves the latest document change events for all live documents.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   event_id: The id of the event that triggered the cloud function mirrored the event.
    --   data: A raw JSON payload of the current state of the document.
    --   document_id: The document id as defined in the Firestore database
    WITH latest AS (
      SELECT max(${timestampColumnName}) as latest_timestamp, document_name
      FROM \`${bqProjectId || process.env.PROJECT_ID}.${datasetId}.${tableName}\`
      GROUP BY document_name
    )
    SELECT
    t.document_name,
    document_id${groupByColumns.length > 0 ? `,` : ``}
      ${groupByColumns.join(",")}
    FROM \`${bqProjectId || process.env.PROJECT_ID}.${datasetId}.${tableName}\` AS t
    JOIN latest ON (t.document_name = latest.document_name AND t.${timestampColumnName} = latest.latest_timestamp)
    WHERE operation != "DELETE"
    GROUP BY document_name, document_id${groupByColumns.length > 0 ? `, ` : ``
    }${groupByColumns.join(",")}`
  );
  return query;
}

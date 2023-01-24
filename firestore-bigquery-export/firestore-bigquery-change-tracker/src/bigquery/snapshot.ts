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

interface LatestConsistentSnapshotViewOptions {
  datasetId: string;
  tableName: string;
  schema: any;
  bqProjectId?: string;
  useLegacyQuery?: boolean;
}

export const latestConsistentSnapshotView = ({
  datasetId,
  tableName,
  schema,
  bqProjectId,
  useLegacyQuery = false,
}: LatestConsistentSnapshotViewOptions) => ({
  query: buildLatestSnapshotViewQuery({
    datasetId,
    tableName,
    timestampColumnName: timestampField.name,
    groupByColumns: schema["fields"]
      .map((field) => field.name)
      .filter((name) => excludeFields.indexOf(name) === -1),
    bqProjectId,
    useLegacyQuery,
  }),
  useLegacySql: false,
});

interface buildLatestSnapshotViewQueryOptions {
  datasetId: string;
  tableName: string;
  timestampColumnName: string;
  groupByColumns: string[];
  bqProjectId?: string;
  useLegacyQuery?: boolean;
}

export function buildLatestSnapshotViewQuery({
  datasetId,
  tableName,
  timestampColumnName,
  groupByColumns,
  bqProjectId,
  useLegacyQuery = true,
}: buildLatestSnapshotViewQueryOptions): string {
  if (datasetId === "" || tableName === "" || timestampColumnName === "") {
    throw Error(`Missing some query parameters!`);
  }
  for (let columnName of groupByColumns) {
    if (columnName === "") {
      throw Error(`Found empty group by column!`);
    }
  }

  const legacyQuery =
    sqlFormatter.format(` -- Retrieves the latest document change events for all live documents.
  --   timestamp: The Firestore timestamp at which the event took place.
  --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
  --   event_id: The id of the event that triggered the cloud function mirrored the event.
  --   data: A raw JSON payload of the current state of the document.
  --   document_id: The document id as defined in the Firestore database
  SELECT
  document_name,
  document_id${groupByColumns.length > 0 ? `,` : ``}
    ${groupByColumns.join(",")}
  FROM (
    SELECT
      document_name,
      document_id,
      ${groupByColumns
        .map(
          (columnName) => `FIRST_VALUE(${columnName})
          OVER(PARTITION BY document_name ORDER BY ${timestampColumnName} DESC)
          AS ${columnName}`
        )
        .join(",")}${groupByColumns.length > 0 ? `,` : ``}
      FIRST_VALUE(operation)
        OVER(PARTITION BY document_name ORDER BY ${timestampColumnName} DESC) = "DELETE"
        AS is_deleted
    FROM \`${bqProjectId || process.env.PROJECT_ID}.${datasetId}.${tableName}\`
    ORDER BY document_name, ${timestampColumnName} DESC
  )
  WHERE NOT is_deleted
  GROUP BY document_name, document_id${
    groupByColumns.length > 0 ? `, ` : ``
  }${groupByColumns.join(",")}`);

  const nonGroupFields = ["event_id", "data", "old_data"];
  const joinFields = ["document_name"];

  const addSelectField = (field) => {
    if (joinFields.includes(field)) return `t.${field}`;

    return nonGroupFields.includes(field)
      ? `ANY_VALUE(${field}) as ${field}`
      : `${field} as ${field}`;
  };

  const filterGroupField = (field) => {
    return nonGroupFields.includes(field);
  };

  const query =
    sqlFormatter.format(` -- Retrieves the latest document change events for all live documents.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   event_id: The id of the event that triggered the cloud function mirrored the event.
    --   data: A raw JSON payload of the current state of the document.
    --   document_id: The document id as defined in the Firestore database
    WITH latest AS (
      SELECT max(${timestampColumnName}) as latest_timestamp, document_name
      FROM \`${
        bqProjectId || process.env.PROJECT_ID
      }.${datasetId}.${tableName}\`
      GROUP BY document_name
    )
    SELECT
    t.document_name,
    document_id${groupByColumns.length > 0 ? `,` : ``}
      ${groupByColumns.map((f) => addSelectField(f)).join(",")}
    FROM \`${
      bqProjectId || process.env.PROJECT_ID
    }.${datasetId}.${tableName}\` AS t
    JOIN latest ON (t.document_name = latest.document_name AND (IFNULL(t.${timestampColumnName}, timestamp("1970-01-01 00:00:00+00"))) = (IFNULL(latest.latest_timestamp, timestamp("1970-01-01 00:00:00+00"))))
    WHERE operation != "DELETE"
    GROUP BY document_name, document_id${
      groupByColumns.length > 0 ? `, ` : ``
    }${groupByColumns.filter((c) => !filterGroupField(c)).join(",")}`);

  return useLegacyQuery ? legacyQuery : query;
}

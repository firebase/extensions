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
const nonGroupFields = ["event_id", "data", "old_data"];
import { TableMetadata } from "@google-cloud/bigquery";
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
    groupByColumns: extractGroupByColumns(schema),
    bqProjectId,
    useLegacyQuery,
  }),
  useLegacySql: false,
});

interface BuildLatestSnapshotViewQueryOptions {
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
}: BuildLatestSnapshotViewQueryOptions): string {
  validateInputs({ datasetId, tableName, timestampColumnName, groupByColumns });

  const projectId = bqProjectId || process.env.PROJECT_ID;

  return useLegacyQuery
    ? buildLegacyQuery(
        projectId,
        datasetId,
        tableName,
        timestampColumnName,
        groupByColumns
      )
    : buildStandardQuery(
        projectId,
        datasetId,
        tableName,
        timestampColumnName,
        groupByColumns
      );
}

function extractGroupByColumns(schema: any): string[] {
  return schema["fields"]
    .map((field: { name: string }) => field.name)
    .filter((name: string) => !excludeFields.includes(name));
}

function validateInputs({
  datasetId,
  tableName,
  timestampColumnName,
  groupByColumns,
}: {
  datasetId: string;
  tableName: string;
  timestampColumnName: string;
  groupByColumns: string[];
}) {
  if (!datasetId || !tableName || !timestampColumnName) {
    throw new Error("Missing required query parameters!");
  }
  if (groupByColumns.some((columnName) => !columnName)) {
    throw new Error("Group by columns must not contain empty values!");
  }
}

function buildLegacyQuery(
  projectId: string,
  datasetId: string,
  tableName: string,
  timestampColumnName: string,
  groupByColumns: string[]
): string {
  return sqlFormatter.format(`
    -- Retrieves the latest document change events for all live documents.
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
            (columnName) => `FIRST_VALUE(${columnName}) OVER (
              PARTITION BY document_name
              ORDER BY ${timestampColumnName} DESC
            ) AS ${columnName}`
          )
          .join(",")}${groupByColumns.length > 0 ? "," : ""}
        FIRST_VALUE(operation) OVER (
          PARTITION BY document_name
          ORDER BY ${timestampColumnName} DESC
        ) = "DELETE" AS is_deleted
      FROM \`${projectId}.${datasetId}.${tableName}\`
      ORDER BY document_name, ${timestampColumnName} DESC
    )
    WHERE NOT is_deleted
    GROUP BY document_name, document_id${
      groupByColumns.length > 0 ? ", " : ""
    }${groupByColumns.join(",")}`);
}

function buildStandardQuery(
  projectId: string,
  datasetId: string,
  tableName: string,
  timestampColumnName: string,
  groupByColumns: string[]
): string {
  return sqlFormatter.format(`
    -- Retrieves the latest document change events for all live documents.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   event_id: The id of the event that triggered the cloud function mirrored the event.
    --   data: A raw JSON payload of the current state of the document.
    --   document_id: The document id as defined in the Firestore database
    WITH latest AS (
      SELECT MAX(${timestampColumnName}) AS latest_timestamp, document_name
      FROM \`${projectId}.${datasetId}.${tableName}\`
      GROUP BY document_name
    )
    SELECT
      t.document_name,
      document_id${groupByColumns.length > 0 ? "," : ""}
      ${groupByColumns
        .map((field) =>
          nonGroupFields.includes(field)
            ? `ANY_VALUE(${field}) AS ${field}`
            : `${field} AS ${field}`
        )
        .join(",")}
    FROM \`${projectId}.${datasetId}.${tableName}\` AS t
    JOIN latest ON (
      t.document_name = latest.document_name AND
      IFNULL(t.${timestampColumnName}, TIMESTAMP("1970-01-01 00:00:00+00")) =
      IFNULL(latest.latest_timestamp, TIMESTAMP("1970-01-01 00:00:00+00"))
    )
    WHERE operation != "DELETE"
    GROUP BY document_name, document_id${
      groupByColumns.length > 0 ? ", " : ""
    }${groupByColumns
    .filter((field) => !nonGroupFields.includes(field))
    .join(",")}`);
}
interface MaterializedViewOptions {
  projectId: string;
  datasetId: string;
  tableName: string;
  rawLatestViewName: string;
  schema: any;
  refreshIntervalMinutes?: number;
  maxStaleness?: string;
}

// type ITimePartitioning = {
//   /**
//    * Optional. Number of milliseconds for which to keep the storage for a partition. A wrapper is used here because 0 is an invalid value.
//    */
//   expirationMs?: string;
//   /**
//    * Optional. If not set, the table is partitioned by pseudo column '_PARTITIONTIME'; if set, the table is partitioned by this field. The field must be a top-level TIMESTAMP or DATE field. Its mode must be NULLABLE or REQUIRED. A wrapper is used here because an empty string is an invalid value.
//    */
//   field?: string;
//   /**
//    * If set to true, queries over this table require a partition filter that can be used for partition elimination to be specified. This field is deprecated; please set the field with the same name on the table itself instead. This field needs a wrapper because we want to output the default value, false, if the user explicitly set it.
//    */
//   requirePartitionFilter?: boolean;
//   /**
//    * Required. The supported types are DAY, HOUR, MONTH, and YEAR, which will generate one partition per day, hour, month, and year, respectively.
//    */
//   type?: string;
// };

interface NonIncrementalMaterializedViewOptions
  extends MaterializedViewOptions {
  enableRefresh?: boolean;
}

// Helper function to extract fields from schema
function extractFieldsFromSchema(schema: any): string[] {
  if (!schema || !schema.fields) {
    throw new Error("Invalid schema: must contain fields array");
  }
  return schema.fields.map((field: { name: string }) => field.name);
}

export function buildMaterializedViewQuery({
  projectId,
  datasetId,
  tableName,
  rawLatestViewName,
  schema,
  refreshIntervalMinutes,
  maxStaleness,
}: NonIncrementalMaterializedViewOptions): {
  target: string;
  source: string;
  query: string;
} {
  // Build the options string
  const options = [];

  if (refreshIntervalMinutes !== undefined) {
    options.push(`refresh_interval_minutes = ${refreshIntervalMinutes}`);
  }

  if (maxStaleness) {
    options.push(`max_staleness = ${maxStaleness}`);
  }

  const optionsString =
    options.length > 0
      ? `OPTIONS (
    ${options.join(",\n  ")}
  )`
      : "";

  // Extract fields from schema
  const fields = extractFieldsFromSchema(schema);

  // Build the aggregated fields for the CTE
  const aggregatedFields = fields
    .map((fieldName) => {
      if (fieldName === "document_name") {
        return "  document_name";
      }
      if (fieldName === "timestamp") {
        return "  MAX(timestamp) AS timestamp";
      }
      return `  MAX_BY(${fieldName}, timestamp) AS ${fieldName}`;
    })
    .join(",\n        ");

  const target = `CREATE MATERIALIZED VIEW \`${projectId}.${datasetId}.${rawLatestViewName}\` ${optionsString}`;

  const source = `
    WITH latests AS (
      SELECT 
      ${aggregatedFields}
      FROM \`${projectId}.${datasetId}.${tableName}\`
      GROUP BY document_name
    )
    SELECT *
    FROM latests
  `;

  // Combine all parts with options before AS
  const fullQuery = sqlFormatter.format(`${target} AS (${source})`);

  return { target, source, query: fullQuery };
}

export function buildNonIncrementalMaterializedViewQuery({
  projectId,
  datasetId,
  tableName,
  rawLatestViewName,
  schema,
  refreshIntervalMinutes,
  maxStaleness,
  enableRefresh = true,
}: NonIncrementalMaterializedViewOptions): {
  target: string;
  source: string;
  query: string;
} {
  // Build the options string
  const options = [];
  options.push("allow_non_incremental_definition = true");

  if (enableRefresh !== undefined) {
    options.push(`enable_refresh = ${enableRefresh}`);
  }

  if (refreshIntervalMinutes !== undefined) {
    options.push(`refresh_interval_minutes = ${refreshIntervalMinutes}`);
  }

  if (maxStaleness) {
    options.push(`max_staleness = ${maxStaleness}`);
  }

  const optionsString =
    options.length > 0
      ? `OPTIONS (
    ${options.join(",\n  ")}
  )`
      : "";

  // Extract fields from schema
  const fields = extractFieldsFromSchema(schema);

  // Build the aggregated fields for the CTE
  const aggregatedFields = fields
    .map((fieldName) => {
      if (fieldName === "document_name") {
        return "  document_name";
      }
      if (fieldName === "timestamp") {
        return "  MAX(timestamp) AS timestamp";
      }
      return `  MAX_BY(${fieldName}, timestamp) AS ${fieldName}`;
    })
    .join(",\n        ");

  const target = `CREATE MATERIALIZED VIEW \`${projectId}.${datasetId}.${rawLatestViewName}\` ${optionsString}`;

  const source = `
    WITH latests AS (
      SELECT 
      ${aggregatedFields}
      FROM \`${projectId}.${datasetId}.${tableName}\`
      GROUP BY document_name
    )
    SELECT *
    FROM latests
    WHERE operation != "DELETE"
  `;

  // Combine all parts with options before AS
  const fullQuery = sqlFormatter.format(`${target} AS (${source})`);

  return { target, source, query: fullQuery };
}

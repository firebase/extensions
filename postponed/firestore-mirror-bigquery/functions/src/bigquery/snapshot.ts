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

import * as logs from "../logs";
import {
  firestoreToBQTable,
  processFirestoreSchema,
  subSelectQuery,
  timestampField,
} from "./schema";

import { FirestoreSchema } from "../firestore/index";


const excludeFields: string[] = [
  "document_name",
];

export const latestConsistentSnapshotView = (
  datasetId: string,
  tableName: string,
) => ({
  query: buildLatestSnapshotViewQuery(datasetId, tableName, timestampField.name,
    firestoreToBQTable()
      .map(field => field.name)
      .filter(name => excludeFields.indexOf(name) == -1)),
  useLegacySql: false,
});

export function buildLatestSnapshotViewQuery(
  datasetId: string,
  tableName: string,
  timestampColumnName: string,
  groupByColumns: string[],
): string {
  if (datasetId === "" || tableName === "" || timestampColumnName === "") {
    throw Error(`Missing some query parameters!`);
  }
  for (let columnName in groupByColumns) {
    if (columnName === "") {
      throw Error(`Found empty group by column!`);
    }
  }
  const query = sqlFormatter.format(
    ` -- Retrieves the latest document change events for all live documents.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   eventId: The id of the event that triggered the cloud function mirrored the event.
    --   data: A raw JSON payload of the current state of the document.
    SELECT
      document_name${groupByColumns.length > 0 ? `,`: ``}
      ${groupByColumns.join(",")}
     FROM (
      SELECT
        document_name,
        ${groupByColumns.map(columnName =>
          `FIRST_VALUE(${columnName})
            OVER(PARTITION BY document_name ORDER BY ${timestampColumnName} DESC)
            AS ${columnName}`).join(',')}${groupByColumns.length > 0 ? `,`: ``}
        FIRST_VALUE(operation)
          OVER(PARTITION BY document_name ORDER BY ${timestampColumnName} DESC) = "DELETE"
          AS is_deleted
      FROM \`${process.env.PROJECT_ID}.${datasetId}.${tableName}\`
      ORDER BY document_name, ${timestampColumnName} DESC
     )
     WHERE NOT is_deleted
     GROUP BY document_name${groupByColumns.length > 0 ? `, `: ``}${groupByColumns.join(",")}`
  );
  return query;
}

/**
 * Given a view created with `userSchemaView` above, this function generates a
 * query that returns the latest set of live documents according to that schema.
 */
export const latestConsistentSnapshotSchemaView = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema,
) => ({
  query: buildLatestSchemaSnapshotViewQuery(datasetId, rawTableName, schema),
  useLegacySql: false,
});

export const buildLatestSchemaSnapshotViewQuery = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema
): string => {
  const firstValue = (selector: string) => {
    return `FIRST_VALUE(${selector}) OVER(PARTITION BY document_name ORDER BY timestamp DESC)`;
  };
  // We need to pass the dataset id into the parser so that we can call the
  // fully qualified json2array persistent user-defined function in the proper
  // scope.
  const [schemaFieldExtractors, schemaFieldArrays, schemaFieldGeopoints] = processFirestoreSchema(datasetId, "data", schema, firstValue);
  const fieldNameSelectorClauses = Object.keys(schemaFieldExtractors).join(', ');
  const fieldValueSelectorClauses = Object.values(schemaFieldExtractors).join(', ');
  const schemaHasArrays = schemaFieldArrays.length > 0;
  const schemaHasGeopoints = schemaFieldGeopoints.length > 0;
  let query = `
      SELECT
        document_name,
        timestamp,
        operation${fieldNameSelectorClauses.length > 0 ? `,` : ``}
        ${fieldNameSelectorClauses}
      FROM (
        SELECT
          document_name,
          ${firstValue(`timestamp`)} AS timestamp,
          ${firstValue(`operation`)} AS operation,
          ${firstValue(`operation`)} = "DELETE" AS is_deleted${fieldValueSelectorClauses.length > 0 ? `,`: ``}
          ${fieldValueSelectorClauses}
        FROM \`${process.env.PROJECT_ID}.${datasetId}.${rawTableName}\`
      )
      WHERE NOT is_deleted
  `;
  const groupableExtractors = Object.keys(schemaFieldExtractors).filter(
    name => schemaFieldArrays.indexOf(name) == -1 && schemaFieldGeopoints.indexOf(name) == -1);
  const hasNonGroupableFields = schemaHasArrays || schemaHasGeopoints;
  // BigQuery doesn't support grouping by array fields or geopoints.
  const groupBy = `
    GROUP BY
      document_name,
      timestamp,
      operation${groupableExtractors.length > 0 ? `,`: ``}
      ${groupableExtractors.length > 0 ? `${groupableExtractors.join(`, `)}` : ``}
  `;
  if (hasNonGroupableFields) {
      query = `
        ${subSelectQuery(query, /*except=*/schemaFieldArrays.concat(schemaFieldGeopoints))}
        ${rawTableName}
        ${schemaFieldArrays.map(arrayFieldName =>
          `CROSS JOIN UNNEST(${rawTableName}.${arrayFieldName})
            AS ${arrayFieldName}_member
            WITH OFFSET ${arrayFieldName}_index`).join(' ')}
      `;
      query = `
        ${query}
        ${groupBy}
        ${schemaHasArrays ? `, ${schemaFieldArrays.map(name => `${name}_index, ${name}_member`).join(', ')}`: ``}
        ${schemaHasGeopoints ? `, ${schemaFieldGeopoints.map(name => `${name}_latitude, ${name}_longitude`).join(', ')}`: ``}
      `;
  } else {
    query = `
      ${query}
      ${groupBy}
    `;
  }
  query = sqlFormatter.format(`
    -- Given a user-defined schema over a raw JSON changelog, returns the
    -- schema elements of the latest set of live documents in the collection.
    --   timestamp: The Firestore timestamp at which the event took place.
    --   operation: One of INSERT, UPDATE, DELETE, IMPORT.
    --   eventId: The event that wrote this row.
    --   <schema-fields>: This can be one, many, or no typed-columns
    --                    corresponding to fields defined in the schema.
    ${query}
  `);
  return query;
}

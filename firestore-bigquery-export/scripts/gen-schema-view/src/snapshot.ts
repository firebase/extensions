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
import {
  buildSchemaViewQuery,
  FirestoreSchema,
  latest,
  processFirestoreSchema,
  subSelectQuery,
  updateFirestoreSchemaFields,
} from "./schema";

export function latestConsistentSnapshotSchemaView(
  datasetId: string,
  rawViewName: string,
  schema: FirestoreSchema
): any {
  const result = buildLatestSchemaSnapshotViewQuery(
    datasetId,
    rawViewName,
    schema
  );
  return {
    viewInfo: {
      query: result.query,
      useLegacySql: false,
    },
    fields: result.fields,
  };
}

export function buildLatestSchemaSnapshotViewQueryFromLatestView(
  datasetId: string,
  tableName: string,
  schema: FirestoreSchema
): any {
  return buildSchemaViewQuery(datasetId, latest(tableName), schema);
}

export const testBuildLatestSchemaSnapshotViewQuery = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema
) => {
  schema.fields = updateFirestoreSchemaFields(schema.fields);
  return buildLatestSchemaSnapshotViewQuery(datasetId, rawTableName, schema);
};

export const buildLatestSchemaSnapshotViewQuery = (
  datasetId: string,
  rawViewName: string,
  schema: FirestoreSchema,
  useNewSqlSyntax = false
): any => {
  // For CTE + JOIN pattern, we don't need window functions - just return the selector as-is
  const identityTransformer = (selector: string, isArrayType?: boolean) => {
    return selector;
  };

  // We need to pass the dataset id into the parser so that we can call the
  // fully qualified json2array persistent user-defined function in the proper
  // scope.
  // Use "t.data" as the dataFieldName since we'll alias the table as "t"
  const result = processFirestoreSchema(
    datasetId,
    "t.data",
    schema,
    identityTransformer
  );

  const [
    schemaFieldExtractors,
    schemaFieldArrays,
    schemaFieldGeopoints,
    schemaArrays,
  ] = result.queryInfo;
  let bigQueryFields = result.fields;
  /*
   * Include additional array schema fields.
   */
  for (let arrayFieldName of schemaFieldArrays) {
    /*
     * Non-groupable arrays will not be included in the view.
     */
    bigQueryFields = bigQueryFields.filter(
      (field) => field.name != `${arrayFieldName}`
    );
    bigQueryFields.push({
      name: `${arrayFieldName}_index`,
      mode: "NULLABLE",
      type: "INTEGER",
      description: `Index of ${arrayFieldName}_member in ${arrayFieldName}.`,
    });
    bigQueryFields.push({
      name: `${arrayFieldName}_member`,
      mode: "NULLABLE",
      type: "STRING",
      description: `String representation of ${arrayFieldName}_member at index ${arrayFieldName}_index in ${arrayFieldName}.`,
    });
  }

  /*
   * latitude and longitude component fields have already been added
   * during firestore schema processing.
   */
  for (let geopointFieldName of schemaFieldGeopoints) {
    bigQueryFields = bigQueryFields.filter(
      (field) => field.name != `${geopointFieldName}`
    );
  }

  const fieldNameSelectorClauses = Object.keys(schemaFieldExtractors).join(
    ", "
  );

  // Replace "data" with "t.data" in extractors to reference the aliased table
  // This is needed because processFirestoreSchemaHelper hardcodes "data" in some places
  const updatedExtractors = Object.entries(schemaFieldExtractors).reduce(
    (acc, [fieldName, extractor]) => {
      // Replace JSON_EXTRACT_SCALAR(data, with JSON_EXTRACT_SCALAR(t.data,
      // Replace JSON_EXTRACT(data, with JSON_EXTRACT(t.data,
      // But be careful not to replace if already "t.data"
      let updatedExtractor = String(extractor);
      if (!updatedExtractor.includes("t.data")) {
        updatedExtractor = updatedExtractor
          .replace(/JSON_EXTRACT_SCALAR\(data,/g, "JSON_EXTRACT_SCALAR(t.data,")
          .replace(/JSON_EXTRACT\(data,/g, "JSON_EXTRACT(t.data,");
      }
      acc[fieldName] = updatedExtractor;
      return acc;
    },
    {} as { [key: string]: string }
  );

  // Extractors already include "AS fieldName", so use them as-is
  const fieldValueSelectorClauses = Object.values(updatedExtractors).join(", ");

  const schemaHasArrays = schemaFieldArrays.length > 0;
  const schemaHasGeopoints = schemaFieldGeopoints.length > 0;

  const groupableExtractors = Object.keys(schemaFieldExtractors).filter(
    (name) =>
      schemaFieldArrays.indexOf(name) === -1 &&
      schemaFieldGeopoints.indexOf(name) === -1
  );

  // Build the CTE for latest timestamps
  const cte = `
    WITH latest_timestamps AS (
      SELECT 
        document_name,
        MAX(timestamp) AS latest_timestamp
      FROM \`${process.env.PROJECT_ID}.${datasetId}.${rawViewName}\`
      GROUP BY document_name
    )`;

  // Build the main SELECT clause
  const selectClause = `
    SELECT
      t.document_name,
      t.document_id,
      t.timestamp,
      t.operation${fieldValueSelectorClauses.length > 0 ? `,` : ``}
      ${fieldValueSelectorClauses}`;

  // Build the FROM and JOIN clauses
  const fromJoinClause = `
    FROM \`${process.env.PROJECT_ID}.${datasetId}.${rawViewName}\` AS t
    INNER JOIN latest_timestamps AS l ON (
      t.document_name = l.document_name AND
      IFNULL(t.timestamp, TIMESTAMP("1970-01-01 00:00:00+00")) =
      IFNULL(l.latest_timestamp, TIMESTAMP("1970-01-01 00:00:00+00"))
    )`;

  // Build the WHERE clause
  const whereClause = `
    WHERE t.operation != "DELETE"`;

  // Build the GROUP BY clause
  const groupByClause = `
    GROUP BY
      t.document_name,
      t.document_id,
      t.timestamp,
      t.operation${groupableExtractors.length > 0 ? `,` : ``}
      ${
        groupableExtractors.length > 0
          ? `${groupableExtractors.join(`, `)}`
          : ``
      }`;

  let query = `${cte}
${selectClause}
${fromJoinClause}
${whereClause}
${groupByClause}`;

  // Handle non-groupable fields (arrays and geopoints) if present
  const hasNonGroupableFields = schemaHasArrays || schemaHasGeopoints;
  if (hasNonGroupableFields) {
    // For arrays and geopoints, we need to wrap the query in a subquery
    // and then join the unnested arrays
    query = `
      ${cte}
      SELECT
        ${rawViewName}.*${schemaFieldArrays.length > 0 ? `,` : ``}
        ${schemaFieldArrays
          .map(
            (arrayFieldName) =>
              `${arrayFieldName}_member, ${arrayFieldName}_index`
          )
          .join(", ")}
      FROM (
        ${selectClause}
        ${fromJoinClause}
        ${whereClause}
        ${groupByClause}
      ) AS ${rawViewName}
      ${schemaFieldArrays
        .map(
          (arrayFieldName) =>
            `LEFT JOIN UNNEST(${rawViewName}.${arrayFieldName})
            AS ${arrayFieldName}_member
            WITH OFFSET ${arrayFieldName}_index`
        )
        .join(" ")}
      GROUP BY
        ${rawViewName}.document_name,
        ${rawViewName}.document_id,
        ${rawViewName}.timestamp,
        ${rawViewName}.operation${groupableExtractors.length > 0 ? `,` : ``}
        ${
          groupableExtractors.length > 0
            ? `${groupableExtractors
                .map((name) => `${rawViewName}.${name}`)
                .join(`, `)}`
            : ``
        }${schemaFieldArrays.length > 0 ? `,` : ``}
        ${schemaFieldArrays
          .map((name) => `${name}_index, ${name}_member`)
          .join(", ")}${schemaHasGeopoints ? `,` : ``}
        ${
          schemaHasGeopoints
            ? `${schemaFieldGeopoints
                .map(
                  (name) =>
                    `${rawViewName}.${name}_latitude, ${rawViewName}.${name}_longitude`
                )
                .join(", ")}`
            : ``
        }`;
  }

  query = sqlFormatter.format(`
    -- Given a user-defined schema over a raw JSON changelog, returns the
    -- schema elements of the latest set of live documents in the collection.
    -- Uses CTE + JOIN pattern for better memory efficiency with large schemas.
    ${query}
  `);
  return { query: query, fields: bigQueryFields };
};

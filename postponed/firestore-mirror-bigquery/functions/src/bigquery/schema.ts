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

import * as bigquery from "@google-cloud/bigquery";
import * as errors from "../errors";
import { FirestoreField, FirestoreSchema } from "../firestore";
import * as logs from "../logs";
import { rawTableName, latestViewName } from "../bigquery";
import { latestConsistentSnapshotSchemaView } from "../bigquery/snapshot";
import * as sqlFormatter from "sql-formatter";

export type BigQueryFieldMode = "NULLABLE" | "REPEATED" | "REQUIRED";
export type BigQueryFieldType =
  | "BOOLEAN"
  | "NUMERIC"
  | "RECORD"
  | "STRING"
  | "TIMESTAMP";
export type BigQueryField = {
  fields?: BigQueryField[];
  mode: BigQueryFieldMode;
  name: string;
  type: BigQueryFieldType;
};

const bigQueryField = (
  name: string,
  type: BigQueryFieldType,
  mode?: BigQueryFieldMode,
  fields?: BigQueryField[]
): BigQueryField => ({
  fields,
  mode: mode || "NULLABLE",
  name,
  type,
});

// These field types form the basis of the `raw` data table
export const dataField = bigQueryField("data", "STRING", "NULLABLE");
export const documentNameField = bigQueryField("document_name", "STRING", "REQUIRED");
export const eventIdField = bigQueryField("eventId", "STRING", "REQUIRED");
export const operationField = bigQueryField("operation", "STRING", "REQUIRED");
export const timestampField = bigQueryField("timestamp", "TIMESTAMP", "REQUIRED");

// These field types are used for the Firestore GeoPoint data type
export const latitudeField = bigQueryField("latitude", "NUMERIC");
export const longitudeField = bigQueryField("longitude", "NUMERIC");

/**
 * A factory class for constructing schema views over raw json time-series
 * change logs.
 */
export class FirestoreBigQuerySchemaViewFactory {
  bq: bigquery.BigQuery;

  constructor() {
    this.bq = new bigquery.BigQuery();
  }

  async initializeSchemaView(
    datasetId: string,
    tableName: string,
    schemaName: string,
    schema: FirestoreSchema,
  ): Promise<bigquery.Table> {
    let realTableName = rawTableName(tableName);
    let viewName = schemaViewName(realTableName, schemaName);
    const dataset = this.bq.dataset(datasetId);

    let view = dataset.table(viewName);
    const [viewExists] = await view.exists();

    let latestView = dataset.table(latestViewName(viewName));
    const [latestViewExists] = await latestView.exists();

    let persistentUDFQuery = jsonToArrayFunction(datasetId);
    await this.bq.query({
      query: persistentUDFQuery.query
    });

    if (!viewExists) {
      logs.bigQueryViewCreating(viewName);
      const options = {
        friendlyName: viewName,
        view: userSchemaView(datasetId, realTableName, schema),
      };
      await view.create(options);
      logs.bigQueryViewCreated(viewName);
    }

    if (!latestViewExists) {
      logs.bigQueryViewCreating(latestViewName(viewName));
      const latestOptions = {
        fiendlyName: latestViewName(viewName),
        view: latestConsistentSnapshotSchemaView(datasetId, realTableName, schema),
      };
      await latestView.create(latestOptions);
      logs.bigQueryViewCreated(latestViewName(viewName));
    }

    return view;
  }

}

/**
 * Convert from a Firestore field definition into the equivalent BigQuery
 * mode.
 *
 * Fields are either:
 * 1) `REPEATED` - they are an array field
 * 2) `NULLABLE` - all other fields are NULLABLE to futureproof the schema
 * definition in case of column deletion in the future
 */
const firestoreToBQMode = (field: FirestoreField) =>
  field.repeated ? "REPEATED" : "NULLABLE";

/**
 * Convert from a list of Firestore field definitions into the schema
 * that will be used by the BigQuery `raw` data table.
 *
 * The `raw` data table schema is:
 * - eventId: The event ID of the function trigger invocation responsible for
 *   the row
 * - timestamp: A timestamp to be used for update ordering
 * - documentName: Stores the name of the Firestore document
 * - operation: The type of operation: INSERT, UPDATE, DELETE
 * - data: A record to contain the Firestore document data fields specified
 * in the schema
 */
export const firestoreToBQTable = (
): BigQueryField[] => [
  timestampField,
  eventIdField,
  documentNameField,
  operationField,
  dataField
];

export function subSelectQuery(query: string, filter?: string[]): string {
  return (`SELECT * ${(filter && filter.length > 0) ? `EXCEPT (${filter.join(', ')})` : ``} FROM (${query})`);
}

export function jsonToArrayFunction(datasetId: string): any {
  const definition: string = jsonToArrayDefinition(datasetId);
  return ({
    query: definition,
    useLegacySql: false
  });
}

function jsonToArrayDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION \`${process.env.PROJECT_ID}.${datasetId}.json2array\`(json STRING)
    RETURNS ARRAY<STRING>
    LANGUAGE js AS """
      return json ? JSON.parse(json).map(x => JSON.stringify(x)) : [];
    """`);
}

function jsonToArray(datasetId:string, selector: string): string {
  return (`\`${process.env.PROJECT_ID}.${datasetId}.json2array\`(${selector})`);
}

const jsonExtract = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string) => string
) => {
  return (transformer(`JSON_EXTRACT(${dataFieldName}, \'\$.${prefix.length > 0 ? `${prefix}.`: ``}${field.name}${subselector}\')`));
}

const jsonExtractScalar = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string) => string
) => {
  return (transformer(`JSON_EXTRACT_SCALAR(${dataFieldName}, \'\$.${prefix.length > 0 ? `${prefix}.`: ``}${field.name}${subselector}\')`));
}

export const userSchemaView = (
  datasetId: string,
  tableName: string,
  schema: FirestoreSchema,
) => ({
  query: buildSchemaViewQuery(datasetId, tableName, schema),
  useLegacySql: false,
});

/**
 * Constructs a query for building a view over a raw changelog table name.
 * It is assumed that `rawTableName` is an existing table with a schema that
 * matches what is returned by `firestoreToBQTable()`.
 * @param datasetId
 * @param rawTableName
 * @param schema
 */
export const buildSchemaViewQuery = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema
): string => {
  const [fieldExtractors, fieldArrays]  = processFirestoreSchema(datasetId, "data", schema);
  const fieldValueSelectorClauses = Object.values(fieldExtractors).join(', ');
  const schemaHasArrays = fieldArrays.length > 0;
  let query = `
    SELECT
      document_name,
      timestamp,
      operation${fieldValueSelectorClauses.length > 0 ? `,`: ``}
      ${fieldValueSelectorClauses}
      FROM
        \`${process.env.PROJECT_ID}.${datasetId}.${rawTableName}\`
  `;
  if (schemaHasArrays) {
    query = `${subSelectQuery(query)} ${rawTableName} ${fieldArrays.map(arrayFieldName =>
      `CROSS JOIN UNNEST(${rawTableName}.${arrayFieldName})
       AS ${arrayFieldName}_member
       WITH OFFSET ${arrayFieldName}_index`).join(' ')}`;
  }
  query = sqlFormatter.format(query);
  return query;
}

/**
 * Given a firestore schema which may contain values for any type present
 * in the Firestore document proto, return a list of clauses that may be
 * used to extract schema values from a JSON string and convert them into
 * the corresponding BigQuery type.
 * @param datasetId
 * @param dataFieldName the name of the columns storing raw JSON data
 * @param schema
 * @param transformer an optional BigQuery function to apply to each
 * select clause found during the search.
 */
export function processFirestoreSchema(
  datasetId: string,
  dataFieldName: string,
  schema: FirestoreSchema,
  transformer?: (selector: string) => string
): [{ [fieldName: string]: string }, string[], string[]] {
  if (!transformer) {
    transformer = (selector: string) => selector;
  }
  let extractors: { [fieldName: string]: string; } = {};
  let arrays: string[] = [];
  let geopoints: string[] = [];
  processFirestoreSchemaHelper(datasetId, dataFieldName, /*prefix=*/"", schema, arrays, geopoints, extractors, transformer);
  return [extractors, arrays, geopoints];
}

function processFirestoreSchemaHelper(
  datasetId: string,
  dataFieldName: string,
  prefix: string,
  schema: FirestoreSchema,
  arrays: string[],
  geopoints: string[],
  extractors: { [fieldName: string]: string },
  transformer: (selector: string) => string
) {
  const { fields, idField } = schema;
  return fields.map((field) => {
    if (field.type === "map") {
      const subschema: FirestoreSchema = { fields: field.fields };
      processFirestoreSchemaHelper(
        datasetId,
        dataFieldName,
        `${prefix.length > 0 ? `${prefix}.` : ``}${field.name}`,
        subschema,
        arrays,
        geopoints,
        extractors,
        transformer
      );
      return;
    }
    const fieldNameToSelector = (processLeafField(datasetId, "data", prefix, field, transformer));
    for (let fieldName in fieldNameToSelector) {
      extractors[fieldName] = fieldNameToSelector[fieldName];
    }
    // For "latest" data views, certain types of fields cannot be used in
    // "GROUP BY" clauses. We keep track of them so they can be explicitly
    // transformed into groupable types later.
    if (field.type === "array") {
      arrays.push(field.name);
    }
    if (field.type === "geopoint") {
      geopoints.push(field.name);
    }
  });
}

const processLeafField = (
  datasetId: string,
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  transformer: (selector: string) => string
) => {
  let fieldNameToSelector = {};
  let selector;
  switch (field.type) {
  case "null":
    selector = transformer(`NULL`);
    break;
  case "string":
    selector = jsonExtractScalar(dataFieldName, prefix, field, ``, transformer);
    break;
  case "array":
    selector = jsonToArray(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
    break;
  case "boolean":
    selector = `CAST(${jsonExtract(dataFieldName, prefix, field, ``, transformer)} AS BOOLEAN)`;
    break;
  case "number":
    selector = `CAST(${jsonExtract(dataFieldName, prefix, field, ``, transformer)} AS NUMERIC)`;
    break;
  case "timestamp":
    selector = `TIMESTAMP_SECONDS(
      CAST(${jsonExtract(dataFieldName, prefix, field, `._seconds`, transformer)} AS INT64) +
      CAST(CAST(${jsonExtract(dataFieldName, prefix, field, `._nanoseconds`, transformer)} AS INT64) / 1E9 AS INT64)
    )`;
    break;
  case "geopoint":
    const latitude = jsonExtract(dataFieldName, prefix, field, `._latitude`, transformer);
    const longitude = jsonExtract(dataFieldName, prefix, field, `._longitude`, transformer);
    // We return directly from this branch because it's the only one that
    // generates multiple selector clauses.
    fieldNameToSelector[`${field.name}`] = `ST_GEOGPOINT(CAST(${latitude} AS NUMERIC), CAST(${longitude} AS NUMERIC)) AS ${field.name}`;
    fieldNameToSelector[`${field.name}_latitude`] = `CAST(${latitude} AS NUMERIC) AS ${field.name}_latitude`;
    fieldNameToSelector[`${field.name}_longitude`] = `CAST(${longitude} AS NUMERIC) AS ${field.name}_longitude`;
    return fieldNameToSelector;
  }
  fieldNameToSelector[field.name] = `${selector} AS ${field.name}`;
  return fieldNameToSelector;
}

function schemaViewName(tableName: string, schemaName: string): string { return `${tableName}_${schemaName}_schema`;  };

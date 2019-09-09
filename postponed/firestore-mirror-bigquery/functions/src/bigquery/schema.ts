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

import {
  firestoreArray,
  firestoreBoolean,
  firestoreNumber,
  firestoreTimestamp,
  firestoreGeopoint,
  udfs
} from "./udfs";

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

  /**
   * Given the name of the raw changelog in BigQuery, constructs a changelog
   * with schema fields extracted into their own BigQuery-typed columns. Also
   * creates a view consisting of only the latest events for all live documents
   * with the schema type applied.
   *
   * This method will not create views if they already exist in BigQuery.
   *
   * @param datasetId
   * @param tableName
   * @param schemaName
   * @param schema
   */
  async initializeSchemaView(
    datasetId: string,
    tableName: string,
    schemaName: string,
    schema: FirestoreSchema,
  ): Promise<bigquery.Table> {
    let rawTable = rawTableName(tableName);
    let viewName = schemaViewName(tableName, schemaName);
    const dataset = this.bq.dataset(datasetId);

    for (let i = 0; i < udfs.length; i++) {
      const udf = udfs[i](datasetId);
      await this.bq.query({
        query: udf.query,
      });
    }

    let view = dataset.table(viewName);
    const [viewExists] = await view.exists();

    let latestView = dataset.table(latestViewName(viewName));
    const [latestViewExists] = await latestView.exists();

    if (!viewExists) {
      logs.bigQueryViewCreating(viewName);
      const options = {
        friendlyName: viewName,
        view: userSchemaView(datasetId, rawTable, schema),
      };
      await view.create(options);
      logs.bigQueryViewCreated(viewName);
    }

    if (!latestViewExists) {
      logs.bigQueryViewCreating(latestViewName(viewName));
      const latestOptions = {
        fiendlyName: latestViewName(viewName),
        view: latestConsistentSnapshotSchemaView(datasetId, rawTable, schema),
      };
      await latestView.create(latestOptions);
      logs.bigQueryViewCreated(latestViewName(viewName));
    }

    return view;
  }

}

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

/**
 * Given a select query, $QUERY, return a query that wraps the result in an
 * outer-select, optionally filtering some fields out using the SQL `EXCEPT`
 * clause. This is used when generating the latest view of a schema change-log
 * in order to omit BigQuery un-groupable columns.
 *
 * SELECT *, EXCEPT (cola, colb, ...) FROM (SELECT ...);
 *
 * @param query a SELECT query
 * @param filter an array of field names to filter out from `query`
 */
export function subSelectQuery(query: string, filter?: string[]): string {
  return (`SELECT * ${(filter && filter.length > 0) ? `EXCEPT (${filter.join(', ')})` : ``} FROM (${query})`);
}

/**
 * Extract a field from a raw JSON string that lives in the column
 * `dataFieldName`. The result of this function is a clause which can be used in
 * the argument of a SELECT query to create a corresponding BigQuery-typed
 * column in the result set.
 *
 * @param dataFieldName the source column containing raw JSON
 * @param prefix the path we need to follow from the root of the JSON to arrive
 * at the named field
 * @param field the field we are extracting
 * @param subselector the path we want to follow within the named field. As an
 * example, this is useful when extracting latitude and longitude from a
 * serialized geopoint field.
 * @param transformer any transformation we want to apply to the result of
 * JSON_EXTRACT. This is typically a BigQuery CAST, or an UNNEST (in the case
 * where the result is an ARRAY).
 */
const jsonExtract = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string) => string
) => {
  return (transformer(`JSON_EXTRACT(${dataFieldName}, \'\$.${prefix.length > 0 ? `${prefix}.`: ``}${field.name}${subselector}\')`));
}

/**
 * A wrapper around `buildSchemaView` that can be passed into BigQuery's
 * `table.create`.
 */
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
    /**
     * If the schema we are generating has arrays, we perform a CROSS JOIN with
     * the result of UNNESTing each array so that each document ends up with N
     * rows, one for each of N members of it's contained array. Each of these
     * rows contains an additional index column and a corresponding member
     * column which can be used to investigate the historical values of various
     * positions inside an array. If a document has multiple arrays, the number
     * of additional rows added per document will be the product of the lengths
     * of all the arrays.
     */
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

/**
 * Searches the user-defined schema and generates a listing of all SELECT
 * clauses which are necessary to generate a BigQuery-typed view over the
 * raw data contained in `dataFieldName`. We keep track of arrays and
 * geopoints separately because they require handling in a context that
 * this function doesn't have access to:
 *
 * - Arrays must be unnested in the non-snapshot query (buildSchemaView) and
 *   filtered out in the snapshot query (buildLatestSnapshotViewQuery) because
 *   they are not groupable
 * - Geopoints must be filtered out in the snapshot query
 *   (buildLatestSnapshotViewQuery) because they are not groupable
 */
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

/**
 * Once we have reached the field in the JSON tree, we must determine what type
 * it is in the schema and then perform any conversions needed to coerce it into
 * the BigQuery type.
 */
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
    selector = jsonExtract(dataFieldName, prefix, field, ``, transformer);
    break;
  case "array":
    selector = firestoreArray(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
    break;
  case "boolean":
    selector = firestoreBoolean(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
    break;
  case "number":
    selector = firestoreNumber(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
    break;
  case "timestamp":
    selector = firestoreTimestamp(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
    break;
  case "geopoint":
    const latitude = jsonExtract(dataFieldName, prefix, field, `._latitude`, transformer);
    const longitude = jsonExtract(dataFieldName, prefix, field, `._longitude`, transformer);
    // We return directly from this branch because it's the only one that
    // generates multiple selector clauses.
    fieldNameToSelector[`${field.name}`] = `${firestoreGeopoint(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer))} AS last_location`;
    fieldNameToSelector[`${field.name}_latitude`] = `CAST(${latitude} AS NUMERIC) AS ${field.name}_latitude`;
    fieldNameToSelector[`${field.name}_longitude`] = `CAST(${longitude} AS NUMERIC) AS ${field.name}_longitude`;
    return fieldNameToSelector;
  }
  fieldNameToSelector[field.name] = `${selector} AS ${field.name}`;
  return fieldNameToSelector;
}

function schemaViewName(tableName: string, schemaName: string): string { return `${tableName}_${schemaName}_schema`;  };

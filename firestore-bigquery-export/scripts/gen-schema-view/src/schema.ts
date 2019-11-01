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
import * as logs from "./logs";
import { latestConsistentSnapshotSchemaView } from "./snapshot";
import * as sqlFormatter from "sql-formatter";
import {
  udfs,
  firestoreArray,
  firestoreBoolean,
  firestoreNumber,
  firestoreTimestamp,
  firestoreGeopoint,
} from "./udf";

export type FirestoreFieldType =
  | "boolean"
  | "geopoint"
  | "number"
  | "map"
  | "array"
  | "null"
  | "string"
  | "timestamp"
  | "reference";

export type FirestoreField = {
  fields?: FirestoreField[];
  name: string;
  repeated?: boolean;
  type: FirestoreFieldType;
};

export type FirestoreSchema = {
  idField?: string;
  fields: FirestoreField[];
  timestampField?: string;
};

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
   */
  async initializeSchemaViewResources(
    datasetId: string,
    tableNamePrefix: string,
    schemaName: string,
    firestoreSchema: FirestoreSchema,
  ): Promise<bigquery.Table> {
    const rawChangeLogTableName = changeLog(raw(tableNamePrefix));
    const latestRawViewName = latest(raw(tableNamePrefix));
    const changeLogSchemaViewName = changeLog(schema(tableNamePrefix, schemaName));
    const latestSchemaViewName = latest(schema(tableNamePrefix, schemaName));
    const dataset = this.bq.dataset(datasetId);

    const udfNames = Object.keys(udfs);

    for (let i = 0; i < udfNames.length; i++) {
      const functionName = udfNames[i];
      const udf = udfs[functionName](datasetId);
      await this.bq.query({
        query: udf.query,
      });
    }

    let view = dataset.table(changeLogSchemaViewName);
    const [viewExists] = await view.exists();

    let latestView = dataset.table(latestSchemaViewName);
    const [latestViewExists] = await latestView.exists();

    if (!viewExists) {
      const schemaView = userSchemaView(datasetId, rawChangeLogTableName, firestoreSchema);
      logs.bigQuerySchemaViewCreating(changeLogSchemaViewName, firestoreSchema, schemaView.query);
      const options = {
        friendlyName: changeLogSchemaViewName,
        view: schemaView,
      };
      await view.create(options);
      logs.bigQuerySchemaViewCreated(changeLogSchemaViewName);
    }

    if (!latestViewExists) {
      const latestSchemaView = buildSchemaViewQuery(datasetId, latestRawViewName, firestoreSchema);
      logs.bigQuerySchemaViewCreating(latestSchemaViewName, firestoreSchema, latestSchemaView);
      const latestOptions = {
        fiendlyName: latestSchemaViewName,
        view: latestSchemaView,
      };
      await latestView.create(latestOptions);
      logs.bigQueryViewCreated(latestSchemaViewName);
    }

    return view;
  }

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
 * It is assumed that `raw` is an existing table with a schema that
 * matches what is returned by `firestoreToBQTable()`.
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
 * Given a Cloud Firestore schema which may contain values for any type present
 * in the Firestore document proto, return a list of clauses that may be
 * used to extract schema values from a JSON string and convert them into
 * the corresponding BigQuery type.
 * @param datasetId the BigQuery dataset
 * @param dataFieldName the name of the columns storing raw JSON data
 * @param schema the Firestore Schema used to create selectors
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
  processFirestoreSchemaHelper(datasetId, dataFieldName, /*prefix=*/[], schema, arrays, geopoints, extractors, transformer);
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
  prefix: string[],
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
        prefix.concat(field.name),
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
      arrays.push(qualifyFieldName(prefix, field.name));
    }
    if (field.type === "geopoint") {
      geopoints.push(qualifyFieldName(prefix, field.name));
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
  prefix: string[],
  field: FirestoreField,
  transformer: (selector: string) => string
) => {
  let extractPrefix = `${prefix.join(".")}`;
  let fieldNameToSelector = {};
  let selector;
  switch (field.type) {
  case "null":
    selector = transformer(`NULL`);
    break;
  case "string":
  case "reference":
    selector = jsonExtract(dataFieldName, extractPrefix, field, ``, transformer);
    break;
  case "array":
    selector = firestoreArray(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
    break;
  case "boolean":
    selector = firestoreBoolean(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
    break;
  case "number":
    selector = firestoreNumber(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
    break;
  case "timestamp":
    selector = firestoreTimestamp(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
    break;
  case "geopoint":
    const latitude = jsonExtract(dataFieldName, extractPrefix, field, `._latitude`, transformer);
    const longitude = jsonExtract(dataFieldName, extractPrefix, field, `._longitude`, transformer);
     /*
      * We return directly from this branch because it's the only one that
      * generates multiple selector clauses.
      */
    fieldNameToSelector[qualifyFieldName(prefix, field.name)] =
      `${firestoreGeopoint(
          datasetId,
          jsonExtract(dataFieldName, extractPrefix, field, ``, transformer)
         )} AS ${prefix.concat(field.name).join("_")}`;
    fieldNameToSelector[qualifyFieldName(prefix, `${field.name}_latitude`)] =
      `SAFE_CAST(${latitude} AS NUMERIC) AS ${qualifyFieldName(prefix, `${field.name}_latitude`)}`;
    fieldNameToSelector[qualifyFieldName(prefix, `${field.name}_longitude`)] =
      `SAFE_CAST(${longitude} AS NUMERIC) AS ${qualifyFieldName(prefix, `${field.name}_longitude`)}`;
    return fieldNameToSelector;
  }
  fieldNameToSelector[qualifyFieldName(prefix, field.name)] = `${selector} AS ${qualifyFieldName(prefix, field.name)}`;
  return fieldNameToSelector;
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

function qualifyFieldName(prefix: string[], name: string): string {
  return prefix.concat(name).join("_");
    }

export function latest(tableName: string): string { return `${tableName}_latest`; };
export function schema(tableName: string, schemaName: string): string { return `${tableName}_schema_${schemaName}`;  };
export function raw(tableName: string): string { return `${tableName}_raw`; };
export function changeLog(tableName: string): string { return `${tableName}_changelog`; };

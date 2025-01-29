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

import { RawChangelogViewSchema } from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as bigquery from "@google-cloud/bigquery";
import * as sqlFormatter from "sql-formatter";
import * as logs from "./logs";
import { latestConsistentSnapshotSchemaView } from "./snapshot";
import {
  firestoreArray,
  firestoreBoolean,
  firestoreGeopoint,
  firestoreNumber,
  firestoreTimestamp,
  udfs,
} from "./udf";

export type FirestoreFieldType =
  | "boolean"
  | "geopoint"
  | "number"
  | "map"
  | "array"
  | "null"
  | "string"
  | "stringified_map"
  | "timestamp"
  | "reference";

type BigQueryFieldType =
  | "BOOLEAN"
  | "GEOGRAPHY"
  | "NUMERIC"
  | "NULL"
  | "STRING"
  | "TIMESTAMP";

export type FirestoreField = {
  fields?: FirestoreField[];
  extractor?: string;
  column_name?: string;
  name: string;
  repeated?: boolean;
  description?: string;
  type: FirestoreFieldType;
};

export type FirestoreSchema = {
  idField?: string;
  fields: FirestoreField[];
  timestampField?: string;
};

/*
 * A static mapping from Firestore types to BigQuery column types. We generate
 * a BigQuery schema in the same pass that generates the view generation query.
 */
const firestoreToBigQueryFieldType: {
  [f in FirestoreFieldType]: BigQueryFieldType;
} = {
  boolean: "BOOLEAN",
  geopoint: "GEOGRAPHY",
  number: "NUMERIC",
  null: "STRING",
  string: "STRING",
  timestamp: "TIMESTAMP",
  reference: "STRING",
  array: null /* mode: REPEATED type: STRING */,
  map: null,
  stringified_map: "STRING",
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
    firestoreSchema: FirestoreSchema
  ): Promise<void> {
    const rawChangeLogTableName = changeLog(raw(tableNamePrefix));
    const latestRawViewName = latest(raw(tableNamePrefix));
    const changeLogSchemaViewName = changeLog(
      schema(tableNamePrefix, schemaName)
    );
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

    if (firestoreSchema.fields) {
      firestoreSchema.fields = updateFirestoreSchemaFields(
        firestoreSchema.fields
      );
    }

    let changeLogSchemaView = dataset.table(changeLogSchemaViewName);
    const [changeLogSchemaViewExists] = await changeLogSchemaView.exists();

    let latestSchemaView = dataset.table(latestSchemaViewName);
    const [latestSchemaViewExists] = await latestSchemaView.exists();

    let result = userSchemaView(
      datasetId,
      rawChangeLogTableName,
      firestoreSchema
    );
    let bigQueryFields = result.fields;

    const changelogOptions = {
      friendlyName: changeLogSchemaViewName,
      view: result.viewInfo,
    };
    if (!changeLogSchemaViewExists) {
      logs.bigQuerySchemaViewCreating(
        changeLogSchemaViewName,
        firestoreSchema,
        result.viewInfo.query
      );
      await changeLogSchemaView.create(changelogOptions);
      logs.bigQuerySchemaViewCreated(changeLogSchemaViewName);
    }

    await changeLogSchemaView.setMetadata({
      schema: decorateSchemaWithChangelogFields({
        fields: bigQueryFields,
      }),
    });

    result = latestConsistentSnapshotSchemaView(
      datasetId,
      latestRawViewName,
      firestoreSchema
    );

    bigQueryFields = result.fields;
    const latestOptions = {
      friendlyName: latestSchemaViewName,
      view: result.viewInfo,
    };
    if (!latestSchemaViewExists) {
      logs.bigQuerySchemaViewCreating(
        latestSchemaViewName,
        firestoreSchema,
        result.viewInfo.query
      );
      await latestSchemaView.create(latestOptions);
      logs.bigQueryViewCreated(latestSchemaViewName);
    }
    await latestSchemaView.setMetadata({
      schema: decorateSchemaWithChangelogFields({
        fields: bigQueryFields,
      }),
    });
  }
}

export function updateFirestoreSchemaFields(fields: FirestoreField[]) {
  return fields.map((field) => {
    return {
      ...field,
      extractor: field.name,
      name: field.column_name || field.name,
    };
  });
}

/**
 * Given a BigQuery schema returned from either `userSchemaView` or
 * `latestConsistentSnapshotSchemaView`, inherit the appropriate
 * fields from the raw changelog schema and return the combined schemas.
 */
function decorateSchemaWithChangelogFields(schema: any): any {
  let decorated: any = { fields: schema.fields };
  const changelogSchemaFields: any[] = RawChangelogViewSchema.fields;
  for (let i = 0; i < changelogSchemaFields.length; i++) {
    if (
      changelogSchemaFields[i].name === "event_id" ||
      changelogSchemaFields[i].name === "data" ||
      changelogSchemaFields[i].name === "old_data"
    ) {
      continue;
    }
    decorated.fields.push(changelogSchemaFields[i]);
  }
  return decorated;
}

/**
 * A wrapper around `buildSchemaView`.
 */
export function userSchemaView(
  datasetId: string,
  tableName: string,
  schema: FirestoreSchema
): any {
  let result = buildSchemaViewQuery(datasetId, tableName, schema);
  return {
    viewInfo: {
      query: result.query,
      useLegacySql: false,
    },
    fields: result.fields,
  };
}

export const testBuildSchemaViewQuery = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema
) => {
  schema.fields = updateFirestoreSchemaFields(schema.fields);
  return buildSchemaViewQuery(datasetId, rawTableName, schema);
};

/**
 * Constructs a query for building a view over a raw changelog table name.
 */
export const buildSchemaViewQuery = (
  datasetId: string,
  rawTableName: string,
  schema: FirestoreSchema
): any => {
  const result = processFirestoreSchema(datasetId, "data", schema);
  const [fieldExtractors, fieldArrays] = result.queryInfo;
  const bigQueryFields = result.fields;
  const fieldValueSelectorClauses = Object.values(fieldExtractors).join(", ");
  const schemaHasArrays = fieldArrays.length > 0;

  let parentColumn = "";
  if (
    rawTableName.includes("_messages") ||
    rawTableName.includes("_items") ||
    rawTableName.includes("_products") ||
    rawTableName.includes("_categories") ||
    rawTableName.includes("_favorites") ||
    rawTableName.includes("_features") ||
    rawTableName.includes("_product_metadata")
  ) {
    parentColumn = "JSON_EXTRACT_SCALAR(path_params, '$.uuid') AS parent_id,";
    bigQueryFields.push({
      name: `parent_id`,
      type: "STRING",
      mode: "NULLABLE",
      description: `Parent id of this sub-collection.`,
    });
  }

  let query = `
    SELECT
      document_name,
      document_id,
      ${parentColumn} 
      timestamp,
      operation${fieldValueSelectorClauses.length > 0 ? `,` : ``}
      ${fieldValueSelectorClauses}
      FROM
        \`${process.env.PROJECT_ID}.${datasetId}.${rawTableName}\`
  `;
  if (schemaHasArrays) {
    /**
     * If the schema we are generating has arrays, we perform a LEFT JOIN with
     * the result of UNNESTing each array so that each document ends up with N
     * rows, one for each of N members of it's contained array. Each of these
     * rows contains an additional index column and a corresponding member
     * column which can be used to investigate the historical values of various
     * positions inside an array. If a document has multiple arrays, the number
     * of additional rows added per document will be the product of the lengths
     * of all the arrays.
     */
    query = `${subSelectQuery(query)} ${rawTableName} ${fieldArrays
      .map(
        (arrayFieldName) =>
          `LEFT JOIN UNNEST(${rawTableName}.${arrayFieldName})
       AS ${arrayFieldName}_member
       WITH OFFSET ${arrayFieldName}_index`
      )
      .join(" ")}`;

    for (const arrayFieldName of fieldArrays) {
      bigQueryFields.push({
        name: `${arrayFieldName}_index`,
        type: "INTEGER",
        mode: "NULLABLE",
        description: `Index of the corresponding ${arrayFieldName}_member cell in ${arrayFieldName}.`,
      });
      bigQueryFields.push({
        name: `${arrayFieldName}_member`,
        type: "STRING",
        mode: "NULLABLE",
        description: `String representation of the member of ${arrayFieldName}[${arrayFieldName}_index].`,
      });
    }
  }
  query = sqlFormatter.format(query);
  return {
    query: query,
    fields: bigQueryFields,
  };
};

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
): any {
  if (!transformer) {
    transformer = (selector: string) => selector;
  }
  let extractors: { [fieldName: string]: string } = {};
  let arrays: string[] = [];
  let geopoints: string[] = [];
  let bigQueryFields: { [property: string]: string }[] = [];
  processFirestoreSchemaHelper(
    datasetId,
    dataFieldName,
    /*prefix=*/ [],
    schema,
    arrays,
    geopoints,
    extractors,
    transformer,
    bigQueryFields,
    []
  );
  return {
    queryInfo: [extractors, arrays, geopoints],
    fields: bigQueryFields,
  };
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
  transformer: (selector: string) => string,
  bigQueryFields: { [property: string]: string }[],
  extractPrefix: string[]
) {
  const { fields = [] } = schema;
  if (!fields.length) return null;
  return fields.map((field) => {
    if (field.type === "map") {
      const subschema: FirestoreSchema = {
        fields: updateFirestoreSchemaFields(field.fields),
      };
      processFirestoreSchemaHelper(
        datasetId,
        dataFieldName,
        prefix.concat(field.name),
        subschema,
        arrays,
        geopoints,
        extractors,
        transformer,
        bigQueryFields,
        extractPrefix.concat(field.extractor)
      );
      return;
    }
    const fieldNameToSelector = processLeafField(
      datasetId,
      "data",
      prefix,
      field,
      transformer,
      bigQueryFields,
      extractPrefix
    );
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
  transformer: (selector: string) => string,
  bigQueryFields: { [property: string]: string }[],
  extractPrefix: string[]
) => {
  const extractPrefixJoined = `${extractPrefix.join(".")}`;

  let fieldNameToSelector = {};
  let selector;
  switch (field.type) {
    case "null":
      selector = transformer(`NULL`);
      break;
    case "stringified_map":
      selector = jsonExtract(
        dataFieldName,
        extractPrefixJoined,
        field,
        "",
        transformer
      );
      break;
    case "string":
    case "reference":
      selector = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        ``,
        transformer
      );
      break;
    case "array":
      selector = firestoreArray(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      );
      break;
    case "boolean":
      selector = firestoreBoolean(
        datasetId,
        jsonExtractScalar(
          dataFieldName,
          extractPrefixJoined,
          field,
          ``,
          transformer
        )
      );
      break;
    case "number":
      selector = firestoreNumber(
        datasetId,
        jsonExtractScalar(
          dataFieldName,
          extractPrefixJoined,
          field,
          ``,
          transformer
        )
      );
      break;
    case "timestamp":
      selector = firestoreTimestamp(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      );
      break;
    case "geopoint":
      const latitude = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        `._latitude`,
        transformer
      );
      const longitude = jsonExtractScalar(
        dataFieldName,
        extractPrefixJoined,
        field,
        `._longitude`,
        transformer
      );
      /*
       * We return directly from this branch because it's the only one that
       * generates multiple selector clauses.
       */
      fieldNameToSelector[
        qualifyFieldName(prefix, field.name)
      ] = `${firestoreGeopoint(
        datasetId,
        jsonExtract(dataFieldName, extractPrefixJoined, field, ``, transformer)
      )} AS ${prefix.concat(field.name).join("_")}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, field.name),
        mode: "NULLABLE",
        type: firestoreToBigQueryFieldType[field.type],
        description: field.description,
      });

      fieldNameToSelector[
        qualifyFieldName(prefix, `${field.name}_latitude`)
      ] = `SAFE_CAST(${latitude} AS NUMERIC) AS ${qualifyFieldName(
        prefix,
        `${field.name}_latitude`
      )}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, `${field.name}_latitude`),
        mode: "NULLABLE",
        type: "NUMERIC",
        description: `Numeric latitude component of ${field.name}.`,
      });

      fieldNameToSelector[
        qualifyFieldName(prefix, `${field.name}_longitude`)
      ] = `SAFE_CAST(${longitude} AS NUMERIC) AS ${qualifyFieldName(
        prefix,
        `${field.name}_longitude`
      )}`;

      bigQueryFields.push({
        name: qualifyFieldName(prefix, `${field.name}_longitude`),
        mode: "NULLABLE",
        type: "NUMERIC",
        description: `Numeric longitude component of ${field.name}.`,
      });
      return fieldNameToSelector;
  }
  fieldNameToSelector[
    qualifyFieldName(prefix, field.name)
  ] = `${selector} AS ${qualifyFieldName(prefix, field.name)}`;
  if (field.type === "array") {
    bigQueryFields.push({
      name: qualifyFieldName(prefix, field.name),
      mode: "REPEATED",
      type: "STRING",
      description: field.description,
    });
  } else {
    bigQueryFields.push({
      name: qualifyFieldName(prefix, field.name),
      mode: "NULLABLE",
      type: firestoreToBigQueryFieldType[field.type],
      description: field.description,
    });
  }

  return fieldNameToSelector;
};

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
const jsonExtractScalar = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string) => string
) => {
  return transformer(
    `JSON_EXTRACT_SCALAR(${dataFieldName}, \'\$.${
      prefix.length > 0 ? `${prefix}.` : ``
    }${field.extractor}${subselector}\')`
  );
};

const jsonExtract = (
  dataFieldName: string,
  prefix: string,
  field: FirestoreField,
  subselector: string = "",
  transformer: (selector: string) => string
) => {
  return transformer(
    `JSON_EXTRACT(${dataFieldName}, \'\$.${
      prefix.length > 0 ? `${prefix}.` : ``
    }${field.extractor}${subselector}\')`
  );
};

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
  return `SELECT * ${
    filter && filter.length > 0 ? `EXCEPT (${filter.join(", ")})` : ``
  } FROM (${query})`;
}

function qualifyFieldName(prefix: string[], name: string): string {
  const notAlphanumericUnderscore = /([^a-zA-Z0-9_])/g;
  const cleanName = name.replace(notAlphanumericUnderscore, "_");

  return prefix.concat(cleanName).join("_");
}

export function latest(tableName: string): string {
  return `${tableName}_latest`;
}
export function schema(tableName: string, schemaName: string): string {
  return `${tableName}_schema_${schemaName}`;
}
export function raw(tableName: string): string {
  return `${tableName}_raw`;
}
export function changeLog(tableName: string): string {
  return `${tableName}_changelog`;
}

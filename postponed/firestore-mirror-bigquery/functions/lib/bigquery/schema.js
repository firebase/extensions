"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bigquery = require("@google-cloud/bigquery");
const logs = require("../logs");
const bigquery_1 = require("../bigquery");
const snapshot_1 = require("../bigquery/snapshot");
const sqlFormatter = require("sql-formatter");
const udfs_1 = require("./udfs");
const bigQueryField = (name, type, mode, fields) => ({
    fields,
    mode: mode || "NULLABLE",
    name,
    type,
});
// These field types form the basis of the `raw` data table
exports.dataField = bigQueryField("data", "STRING", "NULLABLE");
exports.documentNameField = bigQueryField("document_name", "STRING", "REQUIRED");
exports.eventIdField = bigQueryField("eventId", "STRING", "REQUIRED");
exports.operationField = bigQueryField("operation", "STRING", "REQUIRED");
exports.timestampField = bigQueryField("timestamp", "TIMESTAMP", "REQUIRED");
// These field types are used for the Firestore GeoPoint data type
exports.latitudeField = bigQueryField("latitude", "NUMERIC");
exports.longitudeField = bigQueryField("longitude", "NUMERIC");
/**
 * A factory class for constructing schema views over raw json time-series
 * change logs.
 */
class FirestoreBigQuerySchemaViewFactory {
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
    initializeSchemaView(datasetId, tableName, schemaName, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            let rawTable = bigquery_1.rawTableName(tableName);
            let viewName = schemaViewName(tableName, schemaName);
            const dataset = this.bq.dataset(datasetId);
            for (let i = 0; i < udfs_1.udfs.length; i++) {
                const udf = udfs_1.udfs[i](datasetId);
                yield this.bq.query({
                    query: udf.query,
                });
            }
            let view = dataset.table(viewName);
            const [viewExists] = yield view.exists();
            let latestView = dataset.table(bigquery_1.latestViewName(viewName));
            const [latestViewExists] = yield latestView.exists();
            if (!viewExists) {
                logs.bigQueryViewCreating(viewName);
                const options = {
                    friendlyName: viewName,
                    view: exports.userSchemaView(datasetId, rawTable, schema),
                };
                yield view.create(options);
                logs.bigQueryViewCreated(viewName);
            }
            if (!latestViewExists) {
                logs.bigQueryViewCreating(bigquery_1.latestViewName(viewName));
                const latestOptions = {
                    fiendlyName: bigquery_1.latestViewName(viewName),
                    view: snapshot_1.latestConsistentSnapshotSchemaView(datasetId, rawTable, schema),
                };
                yield latestView.create(latestOptions);
                logs.bigQueryViewCreated(bigquery_1.latestViewName(viewName));
            }
            return view;
        });
    }
}
exports.FirestoreBigQuerySchemaViewFactory = FirestoreBigQuerySchemaViewFactory;
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
exports.firestoreToBQTable = () => [
    exports.timestampField,
    exports.eventIdField,
    exports.documentNameField,
    exports.operationField,
    exports.dataField
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
function subSelectQuery(query, filter) {
    return (`SELECT * ${(filter && filter.length > 0) ? `EXCEPT (${filter.join(', ')})` : ``} FROM (${query})`);
}
exports.subSelectQuery = subSelectQuery;
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
const jsonExtract = (dataFieldName, prefix, field, subselector = "", transformer) => {
    return (transformer(`JSON_EXTRACT(${dataFieldName}, \'\$.${prefix.length > 0 ? `${prefix}.` : ``}${field.name}${subselector}\')`));
};
/**
 * A wrapper around `buildSchemaView` that can be passed into BigQuery's
 * `table.create`.
 */
exports.userSchemaView = (datasetId, tableName, schema) => ({
    query: exports.buildSchemaViewQuery(datasetId, tableName, schema),
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
exports.buildSchemaViewQuery = (datasetId, rawTableName, schema) => {
    const [fieldExtractors, fieldArrays] = processFirestoreSchema(datasetId, "data", schema);
    const fieldValueSelectorClauses = Object.values(fieldExtractors).join(', ');
    const schemaHasArrays = fieldArrays.length > 0;
    let query = `
    SELECT
      document_name,
      timestamp,
      operation${fieldValueSelectorClauses.length > 0 ? `,` : ``}
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
        query = `${subSelectQuery(query)} ${rawTableName} ${fieldArrays.map(arrayFieldName => `CROSS JOIN UNNEST(${rawTableName}.${arrayFieldName})
       AS ${arrayFieldName}_member
       WITH OFFSET ${arrayFieldName}_index`).join(' ')}`;
    }
    query = sqlFormatter.format(query);
    return query;
};
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
function processFirestoreSchema(datasetId, dataFieldName, schema, transformer) {
    if (!transformer) {
        transformer = (selector) => selector;
    }
    let extractors = {};
    let arrays = [];
    let geopoints = [];
    processFirestoreSchemaHelper(datasetId, dataFieldName, /*prefix=*/ "", schema, arrays, geopoints, extractors, transformer);
    return [extractors, arrays, geopoints];
}
exports.processFirestoreSchema = processFirestoreSchema;
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
function processFirestoreSchemaHelper(datasetId, dataFieldName, prefix, schema, arrays, geopoints, extractors, transformer) {
    const { fields, idField } = schema;
    return fields.map((field) => {
        if (field.type === "map") {
            const subschema = { fields: field.fields };
            processFirestoreSchemaHelper(datasetId, dataFieldName, `${prefix.length > 0 ? `${prefix}.` : ``}${field.name}`, subschema, arrays, geopoints, extractors, transformer);
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
const processLeafField = (datasetId, dataFieldName, prefix, field, transformer) => {
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
            selector = udfs_1.firestoreArray(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
            break;
        case "boolean":
            selector = udfs_1.firestoreBoolean(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
            break;
        case "number":
            selector = udfs_1.firestoreNumber(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
            break;
        case "timestamp":
            selector = udfs_1.firestoreTimestamp(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer));
            break;
        case "geopoint":
            const latitude = jsonExtract(dataFieldName, prefix, field, `._latitude`, transformer);
            const longitude = jsonExtract(dataFieldName, prefix, field, `._longitude`, transformer);
            // We return directly from this branch because it's the only one that
            // generates multiple selector clauses.
            fieldNameToSelector[`${field.name}`] = `${udfs_1.firestoreGeopoint(datasetId, jsonExtract(dataFieldName, prefix, field, ``, transformer))} AS last_location`;
            fieldNameToSelector[`${field.name}_latitude`] = `CAST(${latitude} AS NUMERIC) AS ${field.name}_latitude`;
            fieldNameToSelector[`${field.name}_longitude`] = `CAST(${longitude} AS NUMERIC) AS ${field.name}_longitude`;
            return fieldNameToSelector;
    }
    fieldNameToSelector[field.name] = `${selector} AS ${field.name}`;
    return fieldNameToSelector;
};
function schemaViewName(tableName, schemaName) { return `${tableName}_${schemaName}_schema`; }
;

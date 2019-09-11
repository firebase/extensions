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
const logs = require("./logs");
const sqlFormatter = require("sql-formatter");
const udf_1 = require("./udf");
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
     */
    initializeSchemaViewResources(datasetId, collectionName, schemaName, firestoreSchema) {
        return __awaiter(this, void 0, void 0, function* () {
            const rawChangeLogTableName = changeLog(raw(collectionName));
            const latestRawViewName = latest(raw(collectionName));
            const changeLogSchemaViewName = changeLog(schema(collectionName, schemaName));
            const latestSchemaViewName = latest(schema(collectionName, schemaName));
            const dataset = this.bq.dataset(datasetId);
            const udfNames = Object.keys(udf_1.udfs);
            for (let i = 0; i < udfNames.length; i++) {
                const functionName = udfNames[i];
                const udf = udf_1.udfs[functionName](datasetId);
                yield this.bq.query({
                    query: udf.query,
                });
            }
            let view = dataset.table(changeLogSchemaViewName);
            const [viewExists] = yield view.exists();
            let latestView = dataset.table(latestSchemaViewName);
            const [latestViewExists] = yield latestView.exists();
            if (!viewExists) {
                const schemaView = exports.userSchemaView(datasetId, rawChangeLogTableName, firestoreSchema);
                logs.bigQuerySchemaViewCreating(changeLogSchemaViewName, firestoreSchema, schemaView.query);
                const options = {
                    friendlyName: changeLogSchemaViewName,
                    view: schemaView,
                };
                yield view.create(options);
                logs.bigQuerySchemaViewCreated(changeLogSchemaViewName);
            }
            if (!latestViewExists) {
                const latestSchemaView = exports.buildSchemaViewQuery(datasetId, latestRawViewName, firestoreSchema);
                logs.bigQuerySchemaViewCreating(latestSchemaViewName, firestoreSchema, latestSchemaView);
                const latestOptions = {
                    fiendlyName: latestSchemaViewName,
                    view: latestSchemaView,
                };
                yield latestView.create(latestOptions);
                logs.bigQueryViewCreated(latestSchemaViewName);
            }
            return view;
        });
    }
}
exports.FirestoreBigQuerySchemaViewFactory = FirestoreBigQuerySchemaViewFactory;
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
 * It is assumed that `raw` is an existing table with a schema that
 * matches what is returned by `firestoreToBQTable()`.
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
 * @param datasetId the BigQuery dataset
 * @param dataFieldName the name of the columns storing raw JSON data
 * @param schema the Firestore Schema used to create selectors
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
    processFirestoreSchemaHelper(datasetId, dataFieldName, /*prefix=*/ [], schema, arrays, geopoints, extractors, transformer);
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
            processFirestoreSchemaHelper(datasetId, dataFieldName, prefix.concat(field.name), subschema, arrays, geopoints, extractors, transformer);
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
const processLeafField = (datasetId, dataFieldName, prefix, field, transformer) => {
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
            selector = udf_1.firestoreArray(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
            break;
        case "boolean":
            selector = udf_1.firestoreBoolean(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
            break;
        case "number":
            selector = udf_1.firestoreNumber(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
            break;
        case "timestamp":
            selector = udf_1.firestoreTimestamp(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer));
            break;
        case "geopoint":
            const latitude = jsonExtract(dataFieldName, extractPrefix, field, `._latitude`, transformer);
            const longitude = jsonExtract(dataFieldName, extractPrefix, field, `._longitude`, transformer);
            /*
             * We return directly from this branch because it's the only one that
             * generate multiple selector clauses.
             */
            fieldNameToSelector[qualifyFieldName(prefix, field.name)] =
                `${udf_1.firestoreGeopoint(datasetId, jsonExtract(dataFieldName, extractPrefix, field, ``, transformer))} AS ${prefix.concat(field.name).join("_")}`;
            fieldNameToSelector[qualifyFieldName(prefix, `${field.name}_latitude`)] =
                `SAFE_CAST(${latitude} AS NUMERIC) AS ${qualifyFieldName(prefix, `${field.name}_latitude`)}`;
            fieldNameToSelector[qualifyFieldName(prefix, `${field.name}_longitude`)] =
                `SAFE_CAST(${longitude} AS NUMERIC) AS ${qualifyFieldName(prefix, `${field.name}_longitude`)}`;
            return fieldNameToSelector;
    }
    fieldNameToSelector[qualifyFieldName(prefix, field.name)] = `${selector} AS ${qualifyFieldName(prefix, field.name)}`;
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
const jsonExtract = (dataFieldName, prefix, field, subselector = "", transformer) => {
    return (transformer(`JSON_EXTRACT(${dataFieldName}, \'\$.${prefix.length > 0 ? `${prefix}.` : ``}${field.name}${subselector}\')`));
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
function subSelectQuery(query, filter) {
    return (`SELECT * ${(filter && filter.length > 0) ? `EXCEPT (${filter.join(', ')})` : ``} FROM (${query})`);
}
exports.subSelectQuery = subSelectQuery;
function qualifyFieldName(prefix, name) {
    return prefix.concat(name).join("_");
}
function latest(tableName) { return `${tableName}_latest`; }
exports.latest = latest;
;
function schema(tableName, schemaName) { return `${tableName}_schema_${schemaName}`; }
exports.schema = schema;
;
function raw(tableName) { return `${tableName}_raw`; }
exports.raw = raw;
;
function changeLog(tableName) { return `${tableName}_changelog`; }
exports.changeLog = changeLog;
;

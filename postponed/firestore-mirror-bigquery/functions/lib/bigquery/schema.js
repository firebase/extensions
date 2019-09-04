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
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors = require("../errors");
const logs = require("../logs");
const bigQueryField = (name, type, mode, fields) => ({
    fields,
    mode: mode || "NULLABLE",
    name,
    type,
});
// These field types form the basis of the `raw` data table
const dataField = bigQueryField("data", "STRING", "NULLABLE");
const keyField = bigQueryField("key", "STRING", "REQUIRED");
const idField = bigQueryField("id", "STRING", "REQUIRED");
const eventIdField = bigQueryField("eventId", "STRING", "REQUIRED");
const operationField = bigQueryField("operation", "STRING", "REQUIRED");
const timestampField = bigQueryField("timestamp", "TIMESTAMP", "REQUIRED");
// These field types are used for the Firestore GeoPoint data type
const latitudeField = bigQueryField("latitude", "NUMERIC");
const longitudeField = bigQueryField("longitude", "NUMERIC");
/**
 * Convert from a Firestore field definition into the equivalent BigQuery
 * mode.
 *
 * Fields are either:
 * 1) `REPEATED` - they are an array field
 * 2) `NULLABLE` - all other fields are NULLABLE to futureproof the schema
 * definition in case of column deletion in the future
 */
const firestoreToBQMode = (field) => field.repeated ? "REPEATED" : "NULLABLE";
/**
 * Convert from a Firestore field definition into the equivalent BigQuery
 * field structure.
 */
exports.firestoreToBQField = (field) => {
    if (field.type === "boolean") {
        return bigQueryField(field.name, "BOOLEAN", firestoreToBQMode(field));
    }
    else if (field.type === "geopoint") {
        return bigQueryField(field.name, "RECORD", firestoreToBQMode(field), [
            latitudeField,
            longitudeField,
        ]);
    }
    else if (field.type === "json") {
        return bigQueryField(field.name, "STRING", firestoreToBQMode(field));
    }
    else if (field.type === "number") {
        return bigQueryField(field.name, "NUMERIC", firestoreToBQMode(field));
    }
    else if (field.type === "map") {
        return bigQueryField(field.name, "RECORD", firestoreToBQMode(field), field.fields.map((subField) => exports.firestoreToBQField(subField)));
    }
    else if (field.type === "reference") {
        return bigQueryField(field.name, "STRING", firestoreToBQMode(field));
    }
    else if (field.type === "string") {
        return bigQueryField(field.name, "STRING", firestoreToBQMode(field));
    }
    else if (field.type === "timestamp") {
        return bigQueryField(field.name, "TIMESTAMP", firestoreToBQMode(field));
    }
    else {
        throw errors.invalidFieldDefinition(field);
    }
};
/**
 * Convert from a list of Firestore field definitions into the schema
 * that will be used by the BigQuery `raw` data table.
 *
 * The `raw` data table schema is:
 * - id: Stores the Firestore document ID
 * - eventId: The event ID of the function trigger invocation responsible for
 *   the row
 * - timestamp: A timestamp to be used for update ordering
 * - operation: The type of operation: INSERT, UPDATE, DELETE
 * - data: A record to contain the Firestore document data fields specified
 * in the schema
 */
exports.firestoreToBQTable = () => [
    timestampField,
    eventIdField,
    keyField,
    idField,
    operationField,
    dataField
];
/**
 * Convert from a Firestore schema into a SQL query that will be used to build
 * the BigQuery view which represents the current state of the data.
 */
exports.firestoreToBQView = (datasetId, tableName, schema, idFieldNames) => ({
    query: buildViewQuery(datasetId, tableName, schema, idFieldNames),
    useLegacySql: false,
});
exports.latestConsistentSnapshotView = (datasetId, tableName) => ({
    query: buildLatestSnapshotViewQuery(datasetId, tableName, timestampField.name, exports.firestoreToBQTable()
        .map(field => field.name)
        .filter(name => name != "key" && name != "id")),
    useLegacySql: false,
});
/**
 * Checks that the BigQuery table schema matches the Firestore field
 * definitions and updates the BigQuery table scheme if necessary.
 */
exports.validateBQTable = (table, fields, idFieldNames) => __awaiter(this, void 0, void 0, function* () {
    logs.bigQueryTableValidating(table.id);
    const [metadata] = yield table.getMetadata();
    // Get the `data` and `id` fields from our schema, as this is what needs to be compared
    const idField = metadata.schema.fields[0];
    const dataField = metadata.schema.fields[4];
    const idFieldsChanged = validateBQIdFields(idField.fields, idFieldNames);
    const dataFieldsChanged = validateBQDataFields(dataField.fields, fields);
    if (dataFieldsChanged || idFieldsChanged) {
        logs.bigQueryTableUpdating(table.id);
        metadata.schema.fields[0] = idField;
        yield table.setMetadata(metadata);
        logs.bigQueryTableUpdated(table.id);
    }
    else {
        logs.bigQueryTableUpToDate(table.id);
    }
    logs.bigQueryTableValidated(table.id);
    return table;
});
/**
 * Checks that the BigQuery fields match the Firestore field definitions.
 * New fields are automatically added, whilst deleted fields are
 * skipped and will no longer be populated with data.
 */
const validateBQDataFields = (bqFields, fsFields) => {
    let fieldsChanged = false;
    fsFields.forEach((fsField) => {
        const bqField = bqFields.find((field) => field.name === fsField.name);
        const bqSchemaField = exports.firestoreToBQField(fsField);
        if (bqField) {
            if (bqField.type !== bqSchemaField.type) {
                throw errors.changedFieldType(bqField.name, bqField.type, bqSchemaField.type);
            }
            else if (bqField.mode !== bqSchemaField.mode) {
                throw errors.changedFieldMode(bqField.name, bqField.mode, bqSchemaField.mode);
            }
            else if (fsField.type === "map") {
                // Validate the subfields for Firestore map fields
                const subFieldsChanged = validateBQDataFields(bqField.fields, fsField.fields);
                if (subFieldsChanged) {
                    fieldsChanged = true;
                }
            }
        }
        else {
            bqFields.push(bqSchemaField);
            fieldsChanged = true;
        }
    });
    return fieldsChanged;
};
/**
 * Checks that the BigQuery ID fields match the expected id fields.
 * New fields are automatically added.
 */
const validateBQIdFields = (bqFields, idFieldNames) => {
    let fieldsChanged = false;
    idFieldNames.forEach((idFieldName) => {
        const idField = bqFields.find((field) => field.name === idFieldName);
        if (!idField) {
            bqFields.push(bigQueryField(idFieldName, "STRING", "REQUIRED"));
            fieldsChanged = true;
        }
    });
    return fieldsChanged;
};
/**
 * Checks that the BigQuery table schema matches the Firestore field
 * definitions and updates the BigQuery table scheme if necessary.
 */
exports.validateBQView = (view, tableName, schema, idFieldNames) => __awaiter(this, void 0, void 0, function* () {
    logs.bigQueryViewValidating(view.id);
    const [metadata] = yield view.getMetadata();
    // Get the `query` field in our schema, as this is what needs to be compared
    const bqViewQuery = metadata.view.query;
    const schemaViewQuery = buildViewQuery(view.dataset.id, tableName, schema, idFieldNames);
    if (bqViewQuery === schemaViewQuery) {
        logs.bigQueryViewUpToDate(view.id);
    }
    else {
        logs.bigQueryViewUpdating(view.id);
        metadata.view.query = schemaViewQuery;
        yield view.setMetadata(metadata);
        logs.bigQueryViewUpdated(view.id);
    }
    logs.bigQueryViewValidated(view.id);
    return view;
});
/**
 * Builds the BigQuery view SQL query that to extract the current state of the
 * `raw` data table.
 */
const buildViewQuery = (datasetId, tableName, schema, idFieldNames) => {
    const { fields, idField } = schema;
    const bqFieldNames = processViewFields("data", fields);
    const hasIdFields = idFieldNames.length > 0;
    const idFieldsString = hasIdFields
        ? `${idFieldNames.map((idFieldName) => `id.${idFieldName}`).join(",")}`
        : undefined;
    return `SELECT ${idField ? "" : "id.id,"} ${hasIdFields ? `${idFieldsString},` : ""} ${bqFieldNames.join(",")} from ( SELECT *, MAX(timestamp) OVER (PARTITION BY id.id${idFieldsString ? `,${idFieldsString}` : ""}) AS max_timestamp FROM \`${process.env.PROJECT_ID}.${datasetId}.${tableName}\`) WHERE timestamp = max_timestamp AND operation != 'DELETE';`;
};
const buildLatestSnapshotViewQuery = (datasetId, tableName, timestampColumnName, groupByColumns) => {
    const query = (`SELECT
      key,
      id,
      ${groupByColumns.join(",")}
     FROM (
      SELECT
        key,
        id,
        ${groupByColumns.map(columnName => `FIRST_VALUE(${columnName})
            OVER(PARTITION BY key ORDER BY ${timestampColumnName} DESC)
            AS ${columnName}`).join(',')},
        FIRST_VALUE(operation)
          OVER(PARTITION BY key ORDER BY ${timestampColumnName} DESC) = "DELETE"
          AS is_deleted
      FROM \`${process.env.PROJECT_ID}.${datasetId}.${tableName}\`
      ORDER BY key, ${timestampColumnName} DESC
     )
     WHERE NOT is_deleted
     GROUP BY key, id, ${groupByColumns.join(",")}`);
    logs.bigQueryLatestSnapshotViewQueryCreated(query);
    return query;
};
/**
 * Converts a set of Firestore field definitions into the equivalent named
 * BigQuery fields.
 */
const processViewFields = (prefix, fields) => {
    return fields.map((field) => {
        if (field.type === "map") {
            const mapFields = processViewFields(`${prefix}.${field.name}`, field.fields);
            return `STRUCT(${mapFields.join(",")}) as ${field.name}`;
        }
        return `${prefix}.${field.name}`;
    });
};

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bigquery = require("@google-cloud/bigquery");
const schema_1 = require("./schema");
const bq = new bigquery.BigQuery();
/**
 * Ensure that the defined Firestore schema exists within BigQuery and
 * contains the correct information.
 *
 * This will check for the following:
 * 1) That the dataset exists
 * 2) That a `${tableName}_raw` data table exists to store how the data changes
 * over time
 * 3) That a `${tableName}` view exists to visualise the current state of the
 * data
 *
 * NOTE: This currently gets executed on every cold start of the function.
 * Ideally this would run once when the mod is installed if that were
 * possible in the future.
 */
exports.initialiseSchema = (datasetId, tableName, schema, idFieldNames) => __awaiter(this, void 0, void 0, function* () {
    console.log("Initialising BigQuery from schema file");
    const viewName = tableName;
    const realTableName = rawTableName(tableName);
    yield intialiseDataset(datasetId);
    yield initialiseTable(datasetId, realTableName, schema.fields, idFieldNames);
    yield initialiseView(datasetId, realTableName, viewName, schema, idFieldNames);
    console.log("Initialised BigQuery");
});
exports.buildDataRow = (idFieldValues, insertId, operation, timestamp, data) => {
    return {
        data,
        id: idFieldValues,
        insertId,
        operation,
        timestamp,
    };
};
/**
 * Insert a row of data into the BigQuery `raw` data table
 */
exports.insertData = (datasetId, tableName, rows) => __awaiter(this, void 0, void 0, function* () {
    const realTableName = rawTableName(tableName);
    const dataset = bq.dataset(datasetId);
    const table = dataset.table(realTableName);
    try {
        yield table.insert(rows);
    }
    catch (err) {
        console.error(`Failed to insert data in BigQuery: ${JSON.stringify(err)}`);
        return err;
    }
});
const rawTableName = (tableName) => `${tableName}_raw`;
/**
 * Check that the specified dataset exists, and create it if it doesn't.
 */
const intialiseDataset = (datasetId) => __awaiter(this, void 0, void 0, function* () {
    const dataset = bq.dataset(datasetId);
    const [datasetExists] = yield dataset.exists();
    if (datasetExists) {
        console.log(`BigQuery dataset already exists: ${datasetId}`);
    }
    else {
        console.log(`Creating BigQuery dataset: ${datasetId}`);
        yield dataset.create();
    }
    return dataset;
});
/**
 * Check that the table exists within the specified dataset, and create it
 * if it doesn't.  If the table does exist, validate that the BigQuery schema
 * is correct and add any missing fields.
 */
const initialiseTable = (datasetId, tableName, fields, idFieldNames) => __awaiter(this, void 0, void 0, function* () {
    const dataset = bq.dataset(datasetId);
    let table = dataset.table(tableName);
    const [tableExists] = yield table.exists();
    if (tableExists) {
        console.log(`BigQuery table already exists: ${tableName}`);
        table = yield schema_1.validateBQTable(table, fields, idFieldNames);
    }
    else {
        console.log(`Creating BigQuery table: ${tableName}`);
        const options = {
            // `friendlyName` needs to be here to satisfy TypeScript
            friendlyName: tableName,
            schema: schema_1.firestoreToBQTable(fields, idFieldNames),
        };
        yield table.create(options);
        console.log(`Created BigQuery table: ${tableName}`);
    }
    return table;
});
/**
 * Check that the view exists within the specified dataset, and create it if
 * it doesn't.
 *
 * The view is created over the `raw` data table and extracts the latest state
 * of the underlying data, whilst excluding any rows that have been delete.
 *
 * By default, the document ID is used as the row ID, but can be overriden
 * using the `idField` property in the schema definition.
 */
const initialiseView = (datasetId, tableName, viewName, schema, idFieldNames) => __awaiter(this, void 0, void 0, function* () {
    const dataset = bq.dataset(datasetId);
    let view = dataset.table(viewName);
    const [viewExists] = yield view.exists();
    if (viewExists) {
        console.log(`BigQuery view already exists: ${viewName}`);
        view = yield schema_1.validateBQView(view, tableName, schema, idFieldNames);
    }
    else {
        console.log(`Creating BigQuery view: ${viewName}`);
        const options = {
            // `friendlyName` needs to be here to satisfy TypeScript
            friendlyName: tableName,
            view: schema_1.firestoreToBQView(datasetId, tableName, schema, idFieldNames),
        };
        yield view.create(options);
        console.log(`Created BigQuery view: ${viewName}`);
    }
    return view;
});

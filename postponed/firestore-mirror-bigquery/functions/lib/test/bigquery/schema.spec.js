"use strict";
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
const chai = require("chai");
const fs = require("fs");
const sqlFormatter = require("sql-formatter");
const util = require("util");
const schema_1 = require("../../bigquery/schema");
const fixturesDir = __dirname + "/../fixtures";
const sqlDir = fixturesDir + "/sql";
const schemaDir = fixturesDir + "/schemas";
const testProjectId = "test";
const testDataset = "test_dataset";
const testTable = "test_table";
const expect = chai.expect;
const readFile = util.promisify(fs.readFile);
process.env.PROJECT_ID = testProjectId;
function readFormattedSQL(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = yield readFile(file, "utf8");
        return sqlFormatter.format(query);
    });
}
function readBigQuerySchema(file) {
    return __awaiter(this, void 0, void 0, function* () {
        return require(file);
    });
}
describe("schema snapshot view sql generation", () => {
    it("should generate the expected sql", () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedQuery = yield readFormattedSQL(`${sqlDir}/fullSchemaChangeLog.txt`);
        const query = schema_1.buildSchemaViewQuery(testDataset, testTable, yield readBigQuerySchema(`${schemaDir}/fullSchema.json`));
        expect(query).to.equal(expectedQuery);
    }));
    it("should generate the expected sql for an empty schema", () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedQuery = yield readFormattedSQL(`${sqlDir}/emptySchemaChangeLog.txt`);
        const query = schema_1.buildSchemaViewQuery(testDataset, testTable, yield readBigQuerySchema(`${schemaDir}/emptySchema.json`));
        expect(query).to.equal(expectedQuery);
    }));
    it("should handle nested maps", () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedQuery = yield readFormattedSQL(`${sqlDir}/nestedMapSchemaChangeLog.txt`);
        const query = schema_1.buildSchemaViewQuery(testDataset, testTable, yield readBigQuerySchema(`${schemaDir}/nestedMapSchema.json`));
        expect(query).to.equal(expectedQuery);
    }));
});

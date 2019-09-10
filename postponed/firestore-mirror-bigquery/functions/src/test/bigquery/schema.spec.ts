import * as chai from "chai";
import * as fs from "fs";
import * as sqlFormatter from "sql-formatter";
import * as util from "util";

import { buildSchemaViewQuery } from "../../bigquery/schema";

const fixturesDir = __dirname + "/../fixtures";
const sqlDir = fixturesDir + "/sql";
const schemaDir = fixturesDir + "/schemas";

const testProjectId = "test";
const testDataset = "test_dataset";
const testTable = "test_table";

const expect = chai.expect;
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

process.env.PROJECT_ID = testProjectId;

async function readFormattedSQL(file: string): Promise<string> {
  const query = await readFile(file, "utf8");
  return sqlFormatter.format(query);
}

async function readBigQuerySchema(file: string): Promise<any> {
  return require(file);
}

describe("schema snapshot view sql generation", () => {
  it("should generate the expected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/fullSchemaChangeLog.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/fullSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should generate the expected sql for an empty schema", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/emptySchemaChangeLog.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/emptySchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should handle nested maps", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/nestedMapSchemaChangeLog.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/nestedMapSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should handle arrays nested in maps with conflicting field names", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/arraysNestedInMapsSchema.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/arraysNestedInMapsSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should handle every possible type nested inside a map", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/fullSchemaSquared.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/fullSchemaSquared.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should handle a map with no key-value pairs", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/emptyMapSchema.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/emptyMapSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should handle references in schemas, and conflicting names at various nesting levels", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/referenceSchema.txt`);
    const query = buildSchemaViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/referenceSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
});

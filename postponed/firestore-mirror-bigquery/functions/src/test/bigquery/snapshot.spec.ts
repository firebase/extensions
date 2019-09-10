import * as chai from "chai";
import * as fs from "fs";
import * as sqlFormatter from "sql-formatter";
import * as util from "util";

import {
  buildLatestSnapshotViewQuery,
  buildLatestSchemaSnapshotViewQuery,
  buildLatestSchemaSnapshotViewQueryFromLatestView,
} from "../../bigquery/snapshot";

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

describe("latest snapshot view sql generation", () => {
  it("should generate the epxected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/latestConsistentSnapshot.txt`);
    const query = buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", ["timestamp", "eventId", "operation", "data"]);
    expect(query).to.equal(expectedQuery);
  });
  it("should generate correct sql with no groupBy columns", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/latestConsistentSnapshotNoGroupBy.txt`);
    const query = buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", []);
    expect(query).to.equal(expectedQuery);
  });
  it("should throw an error for empty group by columns", async () => {
    expect(buildLatestSnapshotViewQuery.bind(testDataset, testTable, "timestamp", [""])).to.throw();
  });
  it("should throw an error for empty timestamp field", async () => {
    expect(buildLatestSnapshotViewQuery.bind(null, testDataset, testTable, "", [])).to.throw();
  });
});

describe("schema snapshot view sql generation", () => {
  it("should generate the expected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/fullSchemaLatest.txt`);
    const query = buildLatestSchemaSnapshotViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/fullSchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should generate the expected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/fullSchemaLatestFromView.txt`);
    const query = buildLatestSchemaSnapshotViewQueryFromLatestView(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/fullSchema.json`));
    await writeFile(`${sqlDir}/fullSchemaLatestFromView.txt`, query);
    expect(query).to.equal(expectedQuery);
  });
  it("should generate the expected sql for an empty schema", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/emptySchemaLatest.txt`);
    const query = buildLatestSchemaSnapshotViewQuery(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/emptySchema.json`));
    expect(query).to.equal(expectedQuery);
  });
  it("should generate the expected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/emptySchemaLatestFromView.txt`);
    const query = buildLatestSchemaSnapshotViewQueryFromLatestView(testDataset, testTable, await readBigQuerySchema(`${schemaDir}/fullSchema.json`));
    expect(query).to.equal(expectedQuery);
  });

});

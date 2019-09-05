import * as chai from "chai";
import * as fs from "fs";
import * as sqlFormatter from "sql-formatter";
import * as util from "util";

import { buildLatestSnapshotViewQuery } from "../../bigquery/snapshot";

const fixturesDir = __dirname + "/../fixtures";
const sqlDir = fixturesDir + "/sql";

const testProjectId = "test";
const testDataset = "test_dataset";
const testTable = "test_table";

const expect = chai.expect;
const readFile = util.promisify(fs.readFile);

process.env.PROJECT_ID = testProjectId;

async function readFormattedSQL(file: string): Promise<string> {
  const query = await readFile(file, "utf8");
  return sqlFormatter.format(query);
}

describe("simple raw changelog schema generation", () => {
  it("should generate the epxected sql", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/latestConsistentSnapshot.txt`);
    const query = buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", ["timestamp", "eventId", "operation", "data"]);
    expect(query).to.equal(expectedQuery);
  });
  it("should generate correct sql with no groupBy columns", async () => {
    const expectedQuery = await readFormattedSQL(`${sqlDir}/latestConsistentSnapshotNoGroupBy.txt`);
    const query = buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", []);
    console.log(query);
    expect(query).to.equal(expectedQuery);
  });
  it("should throw an error for empty group by columns", async () => {
    expect(buildLatestSnapshotViewQuery.bind(testDataset, testTable, "timestamp", [""])).to.throw();
  });
  it("should throw an error for empty timestamp field", async () => {
    expect(buildLatestSnapshotViewQuery.bind(null, testDataset, testTable, "", [])).to.throw();
  });
});

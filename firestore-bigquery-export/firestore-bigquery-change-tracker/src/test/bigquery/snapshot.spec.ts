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

import * as chai from "chai";
import * as fs from "fs";
import * as sqlFormatter from "sql-formatter";
import * as util from "util";

import {
  buildLatestSnapshotViewQuery,
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
    const query = buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", ["timestamp", "event_id", "operation", "data"]);
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

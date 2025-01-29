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
import * as bigquery from "@google-cloud/bigquery";
import * as path from "path";
import {
  buildNonIncrementalMaterializedViewQuery,
  buildLatestSnapshotViewQuery,
  buildMaterializedViewQuery,
} from "../../bigquery/snapshot";
import {
  FirestoreBigQueryEventHistoryTracker,
  RawChangelogViewSchema,
} from "../../bigquery";

const fixturesDir = __dirname + "/../fixtures";
const sqlDir = fixturesDir + "/sql";

const msqlDir = path.join(__dirname, "/msql");

const testProjectId = "test";
const testDataset = "test_dataset";
const testTable = "test_table";

const expect = chai.expect;
const readFile = util.promisify(fs.readFile);

process.env.PROJECT_ID = testProjectId;

const trackerInstance = new FirestoreBigQueryEventHistoryTracker({
  datasetId: "id",
  datasetLocation: undefined,
  tableId: "id",
  transformFunction: "",
  timePartitioning: null,
  timePartitioningField: undefined,
  timePartitioningFieldType: undefined,
  timePartitioningFirestoreField: undefined,
  clustering: null,
  bqProjectId: null,
});

async function readFormattedSQL(file: string): Promise<string> {
  const query = await readFile(file, "utf8");
  return sqlFormatter.format(query);
}

describe("FirestoreBigQueryEventHistoryTracker functionality", () => {
  it('should have a default dataset location of "us"', () => {
    expect(trackerInstance.config.datasetLocation).to.equal("us");
  });

  it("should create a dataset with the location property set", () => {
    expect(trackerInstance.bigqueryDataset()).instanceOf(bigquery.Dataset);
  });
});

describe("materialized view sql generation", () => {
  const testSchema = {
    fields: [
      { name: "document_name" },
      { name: "document_id" },
      { name: "timestamp" },
      { name: "event_id" },
      { name: "operation" },
      { name: "data" },
      { name: "old_data" },
      { name: "extra_field" },
    ],
  };

  describe("incremental materialized view", () => {
    it("should generate correct SQL", async () => {
      const expectedQuery = await readFormattedSQL(
        path.join(msqlDir, "incremental/standard.sql")
      );

      const { query } = buildMaterializedViewQuery({
        projectId: testProjectId,
        datasetId: testDataset,
        tableName: testTable,
        rawLatestViewName: "materialized_view_test",
        schema: testSchema,
      });

      expect(query).to.equal(sqlFormatter.format(expectedQuery));
    });
  });

  describe("non-incremental materialized view", () => {
    it("should generate correct SQL", async () => {
      const expectedQuery = await readFormattedSQL(
        path.join(msqlDir, "nonIncremental/standard.sql")
      );

      const { query } = buildNonIncrementalMaterializedViewQuery({
        projectId: testProjectId,
        datasetId: testDataset,
        tableName: testTable,
        rawLatestViewName: "materialized_view_test",
        schema: testSchema,
        refreshIntervalMinutes: 60,
        maxStaleness: `INTERVAL "4:0:0" HOUR TO SECOND`,
      });

      expect(query).to.equal(sqlFormatter.format(expectedQuery));
    });
  });
});

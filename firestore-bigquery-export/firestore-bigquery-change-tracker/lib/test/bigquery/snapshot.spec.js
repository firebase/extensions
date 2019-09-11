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
const chai = require("chai");
const fs = require("fs");
const sqlFormatter = require("sql-formatter");
const util = require("util");
const snapshot_1 = require("../../bigquery/snapshot");
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
describe("latest snapshot view sql generation", () => {
    it("should generate the epxected sql", () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedQuery = yield readFormattedSQL(`${sqlDir}/latestConsistentSnapshot.txt`);
        const query = snapshot_1.buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", ["timestamp", "event_id", "operation", "data"]);
        expect(query).to.equal(expectedQuery);
    }));
    it("should generate correct sql with no groupBy columns", () => __awaiter(void 0, void 0, void 0, function* () {
        const expectedQuery = yield readFormattedSQL(`${sqlDir}/latestConsistentSnapshotNoGroupBy.txt`);
        const query = snapshot_1.buildLatestSnapshotViewQuery(testDataset, testTable, "timestamp", []);
        expect(query).to.equal(expectedQuery);
    }));
    it("should throw an error for empty group by columns", () => __awaiter(void 0, void 0, void 0, function* () {
        expect(snapshot_1.buildLatestSnapshotViewQuery.bind(testDataset, testTable, "timestamp", [""])).to.throw();
    }));
    it("should throw an error for empty timestamp field", () => __awaiter(void 0, void 0, void 0, function* () {
        expect(snapshot_1.buildLatestSnapshotViewQuery.bind(null, testDataset, testTable, "", [])).to.throw();
    }));
});

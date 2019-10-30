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

import * as fs_find from "fs-find";
import { readdirSync } from "fs";
import { dirname } from "path";
import { promisify } from "util";

import * as chai from "chai";
import * as util from "../../util";

const expect = chai.expect;

const fixturesDir = __dirname + "/../fixtures";
const schemaDir = fixturesDir + "/schema-files";

const find = promisify(fs_find);

console.log(fixturesDir);
console.log(schemaDir);

describe("filesystem schema loading", () => {
  it("should load no schemas from an empty directory", () => {
    const schemas = util.readSchemas([`${schemaDir}/empty-directory`]);
    expect(Object.keys(schemas).length).to.equal(0);
  });
  it("should load one schema from a single file", () => {
    const schemaFile = `${schemaDir}/full-directory/schema-1.json`;
    const schemas = Object.keys(util.readSchemas([schemaFile]));
    expect(schemas.length).to.equal(1);
    expect(schemas[0]).to.equal(util.filePathToSchemaName(schemaFile));
  });
  it("should load many schemas from a full directory, but dedup overlapping names", () => {
    const directoryPath = `${schemaDir}/full-directory`;
    const expectedSchemaNames = [...new Set(readdirSync(directoryPath)
      .map(schemaFile => util.filePathToSchemaName(schemaFile)))];
    const schemas = util.readSchemas([directoryPath]);
    expect(Object.keys(schemas)).to.have.members(expectedSchemaNames);
  });
  it("should load only schemas with names matching glob pattern", () => {
    const globPattern = `${schemaDir}/full-directory/*.json`;
    const expectedSchemaNames = readdirSync(dirname(globPattern))
      .filter(schemaName => schemaName.endsWith(".json"))
      .map(schemaFile => util.filePathToSchemaName(schemaFile));
    const schemas = util.readSchemas([globPattern]);
    expect(Object.keys(schemas)).to.have.members(expectedSchemaNames);
  });
  it("should load all schemas with multiple hierarchy levels", async () => {
    const globPattern = `${schemaDir}/**/*.json`;
    const results: string[] = (await find(schemaDir))
      .filter(schemaFileInfo => schemaFileInfo.file.endsWith(".json"))
      .map(schemaFileInfo => util.filePathToSchemaName(schemaFileInfo.file));
    const schemas = util.readSchemas([globPattern]);
    expect(Object.keys(schemas)).to.have.members(results);
  });
});

/*
 * Copyright 2025 Google LLC
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

import { readdirSync, statSync } from "fs";
import { dirname } from "path";
import * as schema_loader_utils from "../../schema-loader-utils";

const fixturesDir = __dirname + "/../fixtures";
const schemaDir = fixturesDir + "/schema-files";

// Helper function to recursively get all files in a directory
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = dirPath + "/" + file;
    if (statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe("filesystem schema loading", () => {
  test("should load no schemas from an empty directory", () => {
    const schemas = schema_loader_utils.readSchemas([
      `${schemaDir}/empty-directory`,
    ]);
    expect(Object.keys(schemas).length).toBe(0);
  });
  test("should load one schema from a single file", () => {
    const schemaFile = `${schemaDir}/full-directory/schema-1.json`;
    const schemas = Object.keys(schema_loader_utils.readSchemas([schemaFile]));
    expect(schemas.length).toBe(1);
    expect(schemas[0]).toBe(
      schema_loader_utils.filePathToSchemaName(schemaFile)
    );
  });
  test("should load many schemas from a full directory, but dedup overlapping names", () => {
    const directoryPath = `${schemaDir}/full-directory`;
    const expectedSchemaNames = [
      ...new Set(
        readdirSync(directoryPath).map((schemaFile) =>
          schema_loader_utils.filePathToSchemaName(schemaFile)
        )
      ),
    ];
    const schemas = schema_loader_utils.readSchemas([directoryPath]);
    expect(new Set(Object.keys(schemas))).toEqual(new Set(expectedSchemaNames));
  });
  test("should load only schemas with names matching glob pattern", () => {
    const globPattern = `${schemaDir}/full-directory/*.json`;
    const expectedSchemaNames = readdirSync(dirname(globPattern))
      .filter((schemaName) => schemaName.endsWith(".json"))
      .map((schemaFile) =>
        schema_loader_utils.filePathToSchemaName(schemaFile)
      );
    const schemas = schema_loader_utils.readSchemas([globPattern]);
    expect(new Set(Object.keys(schemas))).toEqual(new Set(expectedSchemaNames));
  });
  test("should load all schemas with multiple hierarchy levels", () => {
    const allFiles = getAllFiles(schemaDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => schema_loader_utils.filePathToSchemaName(file));

    const schemas = schema_loader_utils.readSchemas([`${schemaDir}/**/*.json`]);
    expect(new Set(Object.keys(schemas))).toEqual(new Set(allFiles));
  });
  test("should load schemas from a comma-separated list of file paths", () => {
    const schemaFiles = `${schemaDir}/full-directory/schema-1.json,${schemaDir}/full-directory/schema-2.json`;
    const schemas = Object.keys(schema_loader_utils.readSchemas([schemaFiles]));
    expect(schemas.length).toBe(2);
    expect(schemas).toContain(
      schema_loader_utils.filePathToSchemaName(
        `${schemaDir}/full-directory/schema-1.json`
      )
    );
    expect(schemas).toContain(
      schema_loader_utils.filePathToSchemaName(
        `${schemaDir}/full-directory/schema-2.json`
      )
    );
  });
});

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

import * as glob from "glob";
import * as path from "path";

import { FirestoreSchema } from "./schema";

import { existsSync, readdirSync, lstatSync } from "fs";

export function readSchemas(
  globs: string[]
): { [schemaName: string]: FirestoreSchema } {
  let schemas = {};
  let expanded = expandGlobs(globs);
  for (var i = 0; i < expanded.length; i++) {
    let dirent = resolveFilePath(expanded[i]);
    let stats = lstatSync(dirent);
    if (stats.isDirectory()) {
      let directorySchemas = readSchemasFromDirectory(dirent);
      for (let schemaName in directorySchemas) {
        if (schemas.hasOwnProperty(schemaName)) {
          warnDuplicateSchemaName(schemaName);
        }
        schemas[schemaName] = directorySchemas[schemaName];
      }
    } else {
      let schemaName = filePathToSchemaName(dirent);
      if (schemas.hasOwnProperty(schemaName)) {
        warnDuplicateSchemaName(schemaName);
      }
      schemas[schemaName] = readSchemaFromFile(dirent);
    }
  }
  return schemas;
}

function warnDuplicateSchemaName(schemaName: string) {
  console.log(
    `Found multiple schema files named ${schemaName}! Only the last one will be used to create a schema view!`
  );
}

function resolveFilePath(filePath: string): string {
  if (filePath.startsWith(".") || !filePath.startsWith("/")) {
    return [process.cwd(), filePath].join("/");
  }
  return filePath;
}

function expandGlobs(globs: string[]): string[] {
  let results = [];
  for (var i = 0; i < globs.length; i++) {
    let globResults = glob.sync(globs[i]);
    results = results.concat(globResults);
  }
  return results;
}

function readSchemasFromDirectory(
  directory: string
): { [schemaName: string]: FirestoreSchema } {
  let results = {};
  let files = readdirSync(directory);
  const schemaNames = files.map((fileName) => filePathToSchemaName(fileName));
  for (var i = 0; i < files.length; i++) {
    const schema: FirestoreSchema = readSchemaFromFile(
      [directory, files[i]].join("/")
    );
    results[schemaNames[i]] = schema;
  }
  return results;
}

function readSchemaFromFile(file: string): FirestoreSchema {
  return require(file);
}

export function filePathToSchemaName(filePath: string): string {
  return path
    .basename(filePath)
    .split(".")
    .slice(0, -1)
    .join(".")
    .replace(/-/g, "_");
}

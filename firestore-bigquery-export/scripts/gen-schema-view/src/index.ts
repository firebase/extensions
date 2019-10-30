#!/usr/bin/env node

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

import * as bigquery from "@google-cloud/bigquery";
import * as glob from "glob";
import * as program from "commander";
import * as firebase from "firebase-admin";
import * as inquirer from "inquirer";
import * as path from "path";

import { existsSync, readdirSync, lstatSync } from "fs";

import {
  FirestoreBigQuerySchemaViewFactory,
  FirestoreSchema,
} from "./schema";

const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;

const validateInput = (value: any, name: string, regex: RegExp) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  if (!value.match(regex)) {
    return `The ${name} must only contain letters or spaces`;
  }
  return true;
};

function collect(value, previous) {
  return previous.concat([value]);
}

program
  .name("gen-schema-views")
  .option("--no-interactive", "Parse all input from command line flags instead of prompting the caller.", false)
  .option("-p, --project-id <project-id>", "Firebase Project ID for project containing Cloud Firestore database.")
  .option("-d, --dataset-id <dataset-id>", "The ID of the BigQuery dataset containing a raw Cloud Firestore document changelog.")
  .option("-c, --collection <collection>", "The Cloud Firestore collection for which schema views should be generated.")
  .option("-f, --schema-files <file-glob>", "A path in the filesystem specifying a globbed collection of files to read schemas from.", collect, [])

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "project",
    type: "input",
    validate: (value) =>
      validateInput(value, "project ID", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message:
      "What is the ID of the BigQuery dataset the raw changelog lives in? (The dataset and the raw changelog must already exist!)",
    name: "dataset",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "What is the name of the Cloud Firestore Collection that you would like to generate a schema view for?",
    name: "collection",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "Where should this script look for schema definitions? (Enter a comma-separated list of, optionally globbed, paths to files or directories).",
    name: "schemaFiles",
    type: "input"
  }
];

async function run(): Promise<number> {
  program.parse(process.argv);

  let projectId: string;
  let datasetId: string;
  let collectionName: string;
  let schemas: { [schemaName: string]: FirestoreSchema };

  if (!program.interactive) {
    if (program.projectId === undefined || program.datasetId === undefined ||
        program.collection === undefined || program.schemaFiles.length === 0) {
      program.outputHelp();
      process.exit(1);
    }
    projectId = program.projectId;
    datasetId = program.datasetId;
    collectionName = program.collection;
    schemas = readSchemas(program.schemaFiles);
  } else {
    const {
      project,
      dataset,
      collection,
      schemaFiles,
    } = await inquirer.prompt(questions);
    projectId = project;
    datasetId = dataset;
    collectionName = collection;
    schemas = readSchemas(schemaFiles.split(",").map(schemaFileName => schemaFileName.trim()));
  }

  // Set project ID so it can be used in BigQuery intialization
  process.env.PROJECT_ID = projectId;
  // BigQuery aactually requires this variable to set the project correctly.
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  // @ts-ignore string not assignable to enum
  if (Object.keys(schemas).length === 0) {
    console.log(`No schema files found!`);
  }
  const viewFactory = new FirestoreBigQuerySchemaViewFactory();

  for (const schemaName in schemas) {
    await viewFactory.initializeSchemaViewResources(datasetId, collectionName, schemaName, schemas[schemaName]);
  }
  return 0;
};

function readSchemas(globs: string[]): { [schemaName: string]: FirestoreSchema } {
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
  console.log(`Found multiple schema files named ${schemaName}! Only the latest one will be created!`);

}

function resolveFilePath(filePath: string): string {
  if (filePath.startsWith(".") || !filePath.startsWith("/")) {
    filePath = [process.cwd(), filePath].join("/")
  }
  return filePath;
}

function expandGlobs(globs: string[]): string[] {
  let results = [];
  for (var i = 0; i < globs.length; i++) {
    let globResults = glob.sync(globs[i])
    results = results.concat(globResults);
  }
  return results;
}

function readSchemasFromDirectory(directory: string): { [schemaName: string]: FirestoreSchema } {
  let results = {};
  let files = readdirSync(directory);
  let schemaNames = files.map(fileName => filePathToSchemaName(fileName));
  for (var i = 0; i < files.length; i++) {
    const schema: FirestoreSchema = readSchemaFromFile([directory, files[i]].join('/'));
    results[schemaNames[i]] = schema;
  }
  return results;
}

function readSchemaFromFile(file: string): FirestoreSchema {
  return require(file);
}

function filePathToSchemaName(filePath: string): string {
  return path.basename(filePath).split('.').slice(0, -1).join('.').replace(/-/g,'_')
}

run()
  .then((result) => {
    console.log("done.");
    process.exit();
  })
  .catch((error) => {
    console.log(JSON.stringify(error));
    console.error(error.message);
    process.exit();
  });

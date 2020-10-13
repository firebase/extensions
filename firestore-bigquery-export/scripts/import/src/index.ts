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

import * as firebase from "firebase-admin";
import * as program from "commander";
import * as fs from "fs";
import * as inquirer from "inquirer";
import * as util from "util";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

// For reading cursor position.
const exists = util.promisify(fs.exists);
const write = util.promisify(fs.writeFile);
const read = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);

const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;

const FIRESTORE_COLLECTION_NAME_MAX_CHARS = 6144;
const BIGQUERY_RESOURCE_NAME_MAX_CHARS = 1024;

const FIRESTORE_DEFAULT_DATABASE = "(default)";

const validateInput = (
  value: string,
  name: string,
  regex: RegExp,
  sizeLimit: number
) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  if (value.length >= sizeLimit) {
    return `${name} must be at most ${sizeLimit} characters long`;
  }
  if (!value.match(regex)) {
    return `The ${name} must only contain letters or spaces`;
  }
  return true;
};

const validateBatchSize = (value: string) => {
  return parseInt(value, 10) > 0;
};

const validateLocation = (value: string) => {
  const index = [
    "us-west4",
    "us-west2",
    "northamerica-northeast1",
    "us-east4",
    "us-west1",
    "us-west3",
    "southamerica-east1",
    "us-east1",
    "europe-west1",
    "europe-north1",
    "europe-west3",
    "europe-west2",
    "europe-west4",
    "europe-west4",
    "europe-west6",
    "asia-east2",
    "asia-southeast2",
    "asia-south1",
    "asia-northeast2",
    "asia-northeast3",
    "asia-southeast1",
    "australia-southeast1",
    "asia-east1",
    "asia-northeast1",
    "us",
    "eu",
  ].indexOf(value.toLowerCase());

  return index !== -1;
};

program
  .name("fs-bq-import-collection")
  .option(
    "--non-interactive",
    "Parse all input from command line flags instead of prompting the caller.",
    false
  )
  .option(
    "-P, --project <project>",
    "Firebase Project ID for project containing the Cloud Firestore database."
  )
  .option(
    "-s, --source-collection-path <source-collection-path>",
    "The path of the the Cloud Firestore Collection to import from. (This may, or may not, be the same Collection for which you plan to mirror changes.)"
  )
  .option(
    "-q, --query-collection-group <query-collection-group>",
    "A boolean value indicating whether you'd prefer a collection group query (true) or a collection query (false)"
  )
  .option(
    "-d, --dataset <dataset>",
    "The ID of the BigQuery dataset to import to. (A dataset will be created if it doesn't already exist.)"
  )
  .option(
    "-t, --table-name-prefix <table-name-prefix>",
    "The identifying prefix of the BigQuery table to import to. (A table will be created if one doesn't already exist.)"
  )
  .option(
    "-b, --batch-size [batch-size]",
    "Number of documents to stream into BigQuery at once.",
    (value) => parseInt(value, 10),
    300
  )
  .option(
    "-l, --dataset-location <location>",
    "Location of the BigQuery dataset."
  );

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "project",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "project ID",
        FIRESTORE_VALID_CHARACTERS,
        FIRESTORE_COLLECTION_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "What is the path of the the Cloud Firestore Collection you would like to import from? " +
      "(This may, or may not, be the same Collection for which you plan to mirror changes.)",
    name: "sourceCollectionPath",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "collection path",
        FIRESTORE_VALID_CHARACTERS,
        FIRESTORE_COLLECTION_NAME_MAX_CHARS
      ),
  },
  {
    message: "Would you like to import documents via a Collection Group query?",
    name: "queryCollectionGroup",
    type: "confirm",
    default: false,
  },
  {
    message:
      "What is the ID of the BigQuery dataset that you would like to use? (A dataset will be created if it doesn't already exist)",
    name: "dataset",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "dataset",
        BIGQUERY_VALID_CHARACTERS,
        BIGQUERY_RESOURCE_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "What is the identifying prefix of the BigQuery table that you would like to import to? (A table will be created if one doesn't already exist)",
    name: "table",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "table",
        BIGQUERY_VALID_CHARACTERS,
        BIGQUERY_RESOURCE_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "How many documents should the import stream into BigQuery at once?",
    name: "batchSize",
    type: "input",
    default: 300,
    validate: validateBatchSize,
  },
  {
    message: "Where would you like the BigQuery dataset to be located?",
    name: "datasetLocation",
    type: "input",
    default: "us",
    validate: validateLocation,
  },
];

interface CliConfig {
  projectId: string;
  sourceCollectionPath: string;
  datasetId: string;
  tableId: string;
  batchSize: string;
  queryCollectionGroup: boolean;
  datasetLocation: string;
}

const run = async (): Promise<number> => {
  const {
    projectId,
    sourceCollectionPath,
    queryCollectionGroup,
    datasetId,
    tableId,
    batchSize,
    datasetLocation,
  }: CliConfig = await parseConfig();

  const batch = parseInt(batchSize);
  const rawChangeLogName = `${tableId}_raw_changelog`;
  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });
  // Set project ID so it can be used in BigQuery intialization
  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  // We pass in the application-level "tableId" here. The tracker determines
  // the name of the raw changelog from this field.
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId: tableId,
    datasetId: datasetId,
    datasetLocation,
  });

  console.log(
    `Importing data from Cloud Firestore Collection${
      queryCollectionGroup ? " (via a Collection Group query)" : ""
    }: ${sourceCollectionPath}, to BigQuery Dataset: ${datasetId}, Table: ${rawChangeLogName}`
  );

  // Build the data row with a 0 timestamp. This ensures that all other
  // operations supersede imports when listing the live documents.
  let cursor;

  let cursorPositionFile =
    __dirname +
    `/from-${sourceCollectionPath}-to-${projectId}_${datasetId}_${rawChangeLogName}`;
  if (await exists(cursorPositionFile)) {
    let cursorDocumentId = (await read(cursorPositionFile)).toString();
    cursor = await firebase
      .firestore()
      .doc(cursorDocumentId)
      .get();
    console.log(
      `Resuming import of Cloud Firestore Collection ${sourceCollectionPath} ${
        queryCollectionGroup ? " (via a Collection Group query)" : ""
      } from document ${cursorDocumentId}.`
    );
  }

  let totalRowsImported = 0;

  do {
    if (cursor) {
      await write(cursorPositionFile, cursor.ref.path);
    }

    let query: firebase.firestore.Query;

    if (queryCollectionGroup) {
      query = firebase.firestore().collectionGroup(sourceCollectionPath);
    } else {
      query = firebase.firestore().collection(sourceCollectionPath);
    }

    query = query.limit(batch);

    if (cursor) {
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs;
    if (docs.length === 0) {
      break;
    }
    cursor = docs[docs.length - 1];
    const rows: FirestoreDocumentChangeEvent[] = docs.map((snapshot) => {
      return {
        timestamp: new Date(0).toISOString(), // epoch
        operation: ChangeType.IMPORT,
        documentName: `projects/${projectId}/databases/${FIRESTORE_DEFAULT_DATABASE}/documents/${
          snapshot.ref.path
        }`,
        documentId: snapshot.id,
        eventId: "",
        data: snapshot.data(),
      };
    });
    await dataSink.record(rows);
    totalRowsImported += rows.length;
  } while (true);

  try {
    await unlink(cursorPositionFile);
  } catch (e) {
    console.log(
      `Error unlinking journal file ${cursorPositionFile} after successful import: ${e.toString()}`
    );
  }

  return totalRowsImported;
};

async function parseConfig(): Promise<CliConfig> {
  program.parse(process.argv);
  if (program.nonInteractive) {
    if (
      program.project === undefined ||
      program.sourceCollectionPath === undefined ||
      program.dataset === undefined ||
      program.tableNamePrefix === undefined ||
      program.queryCollectionGroup === undefined ||
      program.batchSize === undefined ||
      program.datasetLocation === undefined ||
      !validateBatchSize(program.batchSize)
    ) {
      program.outputHelp();
      process.exit(1);
    }
    return {
      projectId: program.project,
      sourceCollectionPath: program.sourceCollectionPath,
      datasetId: program.dataset,
      tableId: program.tableNamePrefix,
      batchSize: program.batchSize,
      queryCollectionGroup: program.queryCollectionGroup === "true",
      datasetLocation: program.datasetLocation,
    };
  }
  const {
    project,
    sourceCollectionPath,
    dataset,
    table,
    batchSize,
    queryCollectionGroup,
    datasetLocation,
  } = await inquirer.prompt(questions);
  return {
    projectId: project,
    sourceCollectionPath: sourceCollectionPath,
    datasetId: dataset,
    tableId: table,
    batchSize: batchSize,
    queryCollectionGroup: queryCollectionGroup,
    datasetLocation: datasetLocation,
  };
}

run()
  .then((rowCount) => {
    console.log("---------------------------------------------------------");
    console.log(`Finished importing ${rowCount} Firestore rows to BigQuery`);
    console.log("---------------------------------------------------------");
    process.exit();
  })
  .catch((error) => {
    console.error(
      `Error importing Collection to BigQuery: ${error.toString()}`
    );
    process.exit(1);
  });

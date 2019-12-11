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
import * as firebase from "firebase-admin";
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

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "projectId",
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
    message:
      "What is the ID of the BigQuery dataset that you would like to use? (A dataset will be created if it doesn't already exist)",
    name: "datasetId",
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
    name: "tableId",
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
    validate: (value) => {
      return parseInt(value, 10) > 0;
    },
  },
];

const run = async (): Promise<number> => {
  const {
    projectId,
    sourceCollectionPath,
    datasetId,
    tableId,
    batchSize,
  } = await inquirer.prompt(questions);

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
  });

  console.log(
    `Importing data from Cloud Firestore Collection: ${sourceCollectionPath}, to BigQuery Dataset: ${datasetId}, Table: ${rawChangeLogName}`
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
      .collection(sourceCollectionPath)
      .doc(cursorDocumentId)
      .get();
    console.log(
      `Resuming import of Cloud Firestore Collection ${sourceCollectionPath} from document ${cursorDocumentId}.`
    );
  }

  let totalDocsRead = 0;
  let totalRowsImported = 0;

  do {
    if (cursor) {
      await write(cursorPositionFile, cursor.id);
    }
    let query = firebase
      .firestore()
      .collection(sourceCollectionPath)
      .limit(batch);
    if (cursor) {
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs;
    if (docs.length === 0) {
      break;
    }
    totalDocsRead += docs.length;
    cursor = docs[docs.length - 1];
    const rows: FirestoreDocumentChangeEvent[] = docs.map((snapshot) => {
      return {
        timestamp: new Date(0).toISOString(), // epoch
        operation: ChangeType.IMPORT,
        documentName: `projects/${projectId}/databases/${FIRESTORE_DEFAULT_DATABASE}/documents/${
          snapshot.ref.path
        }`,
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

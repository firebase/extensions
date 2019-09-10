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

import * as generateSchema from "generate-schema";

import { FirestoreBigQueryEventHistoryTracker } from "../bigquery";
import { extractSnapshotData, FirestoreSchema } from "../firestore";
import {
  extractIdFieldNames,
  extractIdFieldValues,
  extractTimestamp,
} from "../util";
import { ChangeType, FirestoreDocumentChangeEvent } from "../firestoreEventHistoryTracker";

// For reading cursor position.
const exists = util.promisify(fs.exists);
const write = util.promisify(fs.writeFile);
const read = util.promisify(fs.readFile);

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

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "projectId",
    type: "input",
    validate: (value) =>
      validateInput(value, "project ID", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message: "What is the path of the the collection you would like to import from?",
    name: "collectionPath",
    type: "input",
    validate: (value) =>
      validateInput(value, "collection path", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message:
      "What is the ID of the BigQuery dataset that you would like to use? (The dataset will be created if it doesn't already exist)",
    name: "datasetId",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "What is the ID of the BigQuery table import into? (The table will be created if it doesn't already exist)",
    name: "tableName",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "How many documents should the import stream into BigQuery at once?",
    name: "batchSize",
    type: "input",
    default: 300,
    validate: (value) => {
      return parseInt(value, 10) > 0
    }
  },

];

const run = async (): Promise<number> => {
  const {
    projectId,
    collectionPath,
    datasetId,
    tableName,
    batchSize,
  } = await inquirer.prompt(questions);

  const batch = parseInt(batchSize);

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });
  // Set project ID so it can be used in BigQuery intialization
  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    collectionPath: collectionPath,
    datasetId: datasetId,
    tableName: tableName,
    initialized: false,
  });

  console.log(
    `Importing data from Firestore Collection: ${collectionPath}, to BigQuery Dataset: ${datasetId}, Table: ${tableName}`
  );

  // Build the data row with a 0 timestamp. This ensures that all other
  // operations supersede imports when listing the live documents.
  let cursor;

  let cursorPositionFile = __dirname + `/from-${collectionPath}-to-${projectId}\:${datasetId}\:${tableName}`;
  if (await exists(cursorPositionFile)) {
    let cursorDocumentId = (await read(cursorPositionFile)).toString();
    cursor = await firebase
      .firestore()
      .collection(collectionPath)
      .doc(cursorDocumentId)
      .get();
    console.log(
      `Resuming import of collection ${collectionPath} from document ${cursorDocumentId}.`
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
      .collection(collectionPath)
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
    const rows: FirestoreDocumentChangeEvent[] = docs.map(
      (snapshot) => {
        return {
          timestamp: new Date(0), // epoch
          operation: ChangeType.IMPORT,
          documentName: snapshot.ref.path,
          eventId: "",
          data: snapshot.data(),
        };
      });
    await dataSink.record(rows);
    totalRowsImported += rows.length;
  } while (true);

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
    console.error(error.message);
    console.log("---------------------------------------------------------");
    process.exit();
  });

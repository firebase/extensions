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
import * as inquirer from "inquirer";

import { FirestoreBigQueryEventHistoryTracker } from "../bigquery";
import { extractSnapshotData, FirestoreSchema } from "../firestore";
import {
  extractIdFieldNames,
  extractIdFieldValues,
  extractTimestamp,
} from "../util";
import { ChangeType, FirestoreDocumentChangeEvent } from "../firestoreEventHistoryTracker";

const schemaFile = require("../../schema.json");

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
    message: "What is the path of the the collection you would like to mirror?",
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
      "What is the ID of the BigQuery table that you would like to use? (The table will be created if it doesn't already exist)",
    name: "tableName",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset", BIGQUERY_VALID_CHARACTERS),
  },
];

const run = async (): Promise<number> => {
  const {
    collectionPath,
    datasetId,
    projectId,
    tableName,
  } = await inquirer.prompt(questions);

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });
  // Set project ID so it can be used in BigQuery intialization
  process.env.PROJECT_ID = projectId;

  // @ts-ignore string not assignable to enum
  const schema: FirestoreSchema = schemaFile;
  const { fields, timestampField } = schema;

  // Is the collection path for a sub-collection and does the collection path
  // contain any wildcard parameters
  const idFieldNames = extractIdFieldNames(collectionPath);

  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    collectionPath: collectionPath,
    datasetId: datasetId,
    tableName: tableName,
    initialized: false,
  });

  console.log(
    `Mirroring data from Firestore Collection: ${collectionPath}, to BigQuery Dataset: ${datasetId}, Table: ${tableName}`
  );

  const importTimestamp = new Date().toISOString();

  // Load all the data for the collection
  const collectionSnapshot = await firebase
    .firestore()
    .collection(collectionPath)
    .get();
  // Build the data rows to insert into BigQuery
  const rows: FirestoreDocumentChangeEvent[] = collectionSnapshot.docs.map(
    (snapshot) => {
      const data = extractSnapshotData(snapshot, fields);

      let defaultTimestamp;
      if (snapshot.updateTime) {
        defaultTimestamp = snapshot.updateTime.toDate().toISOString();
      } else if (snapshot.createTime) {
        defaultTimestamp = snapshot.createTime.toDate().toISOString();
      } else {
        defaultTimestamp = importTimestamp;
      }

      // Extract the timestamp, or use the import timestamp as default
      const timestamp = extractTimestamp(
        data,
        defaultTimestamp,
        timestampField
      );
      // Build the data row with a 0 timestamp. This ensures that all other
      // operations supersede imports when listing the live documents.
      return {
        timestamp: new Date(0), // epoch
        operation: ChangeType.IMPORT,
        documentName: snapshot.ref.path,
        eventId: "",
        data,
      };
    }
  );

  dataSink.record(rows);

  return rows.length;
};

run()
  .then((rowCount) => {
    console.log("---------------------------------------------------------");
    console.log(`Finished mirroring ${rowCount} Firestore rows to BigQuery`);
    console.log("---------------------------------------------------------");
    process.exit();
  })
  .catch((error) => {
    console.error(error.message);
    console.log("---------------------------------------------------------");
    process.exit();
  });

import * as bigquery from "@google-cloud/bigquery";
import * as firebase from "firebase-admin";
import * as inquirer from "inquirer";

import { buildDataRow, initialiseSchema, insertData } from "../bigquery";
import { extractSnapshotData, FirestoreSchema } from "../firestore";
import {
  extractIdFieldNames,
  extractIdFieldValues,
  extractTimestamp,
} from "../util";

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

  // This initialisation should be moved to `mod install` if Mods adds support
  // for executing code as part of the install process
  // Currently it runs on every cold start of the function
  await initialiseSchema(datasetId, tableName, schema, idFieldNames);

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
  const rows: bigquery.RowMetadata[] = collectionSnapshot.docs.map(
    (snapshot) => {
      const data = extractSnapshotData(snapshot, fields);

      // Extract the values of any `idFieldNames` specifed in the collection path
      const { id, idFieldValues } = extractIdFieldValues(
        snapshot,
        idFieldNames
      );

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
      // Build the data row
      return buildDataRow(idFieldValues, id, "INSERT", timestamp, data);
    }
  );
  await insertData(datasetId, tableName, rows);

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

import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";
import * as _ from "lodash";

import { initialiseSchema, insertData } from "./bigquery";
import { extractSnapshotData, FirestoreSchema } from "./firestore";

// TODO: How can we load a file dynamically?
const schemaFile = require("../schema.json");

// Flag to indicate if the BigQuery schema has been initialised.
// This is a work around to prevent the need to run the initialisation on every
// function execution and instead restricts the initialisation to cold starts
// of the function.
let isSchemaInitialised = false;

exports.fsmirrorbigquery = functions.handler.firestore.document.onWrite(
  async (change, context) => {
    const collectionPath = process.env.COLLECTION_PATH;
    const datasetId = process.env.DATASET_ID;
    const tableName = process.env.TABLE_NAME;

    // @ts-ignore string not assignable to enum
    const schema: FirestoreSchema = schemaFile;
    const { fields, timestampField } = schema;

    // Is the collection path for a sub-collection and does the collection path
    // contain any wildcard parameters
    // NOTE: This is a workaround as `context.params` is not available in the
    // `.handler` namespace
    let idFieldNames = [];
    if (collectionPath.includes("/")) {
      idFieldNames = collectionPath
        // Find the params surrounded by `{` and `}`
        .match(/{[^}]*}/g)
        // Strip the `{` and `}` characters
        .map((fieldName) => fieldName.substring(1, fieldName.length - 1));
    }

    // This initialisation should be moved to `mod install` if Mods adds support
    // for executing code as part of the install process
    // Currently it runs on every cold start of the function
    if (!isSchemaInitialised) {
      await initialiseSchema(datasetId, tableName, schema, idFieldNames);
      isSchemaInitialised = true;
    }

    console.log(
      `Mirroring data from Firestore Collection: ${
        process.env.COLLECTION_PATH
      }, to BigQuery Dataset: ${datasetId}, Table: ${tableName}`
    );

    // Identify the operation and data to be inserted
    let data;
    let snapshot: firebase.firestore.DocumentSnapshot;
    let operation;
    if (!change.after.exists) {
      operation = "DELETE";
      snapshot = change.before;
    } else if (!change.before.exists) {
      operation = "INSERT";
      snapshot = change.after;
      data = extractSnapshotData(snapshot, fields);
    } else {
      operation = "UPDATE";
      snapshot = change.after;
      data = extractSnapshotData(snapshot, fields);
    }

    // Extract the values of any `idFieldNames` specifed in the collection path
    let docRef = snapshot.ref;
    const idFieldValues = {
      id: docRef.id,
    };
    for (let i = 0; i < idFieldNames.length; i++) {
      docRef = docRef.parent.parent;
      idFieldValues[idFieldNames[i]] = docRef.id;
    }

    // If a `timestampField` is specified in the schema then we use the value
    // of the field as the timestamp, rather than the event timestamp
    let timestamp;
    if (timestampField) {
      timestamp = _.get(data, timestampField);
      if (!timestamp) {
        console.warn(
          `Missing value for timestamp field: ${timestampField}, using event timestamp instead.`
        );
        timestamp = context.timestamp;
      }
    } else {
      timestamp = context.timestamp;
    }

    return insertData(
      datasetId,
      tableName,
      idFieldValues,
      // Use the function's event ID to protect against duplicate executions
      context.eventId,
      operation,
      timestamp,
      data
    );
  }
);

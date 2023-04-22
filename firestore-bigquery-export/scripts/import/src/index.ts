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
import * as util from "util";
import * as filenamify from "filenamify";
import { runMultiThread } from "./run";
import { resolveWildcardIds } from "./config";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import { parseConfig } from "./config";

// For reading cursor position.
const exists = util.promisify(fs.exists);
const write = util.promisify(fs.writeFile);
const read = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);

const FIRESTORE_DEFAULT_DATABASE = "(default)";

const packageJson = require("../package.json");

program
  .name("fs-bq-import-collection")
  .description(packageJson.description)
  .version(packageJson.version)
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
    "-q, --query-collection-group [true|false]",
    "Use 'true' for a collection group query, otherwise a collection query is performed."
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
  )
  .option(
    "-m, --multi-threaded [true|false]",
    "Whether to run standard or multi-thread import version"
  )
  .option(
    "-u, --use-new-snapshot-query-syntax [true|false]",
    "Whether to use updated latest snapshot query"
  )
  .option(
    "-e, --use-emulator [true|false]",
    "Whether to use the firestore emulator"
  );

const run = async (): Promise<number> => {
  const config = await parseConfig();
  if (config.kind === "ERROR") {
    config.errors?.forEach((e) => console.error(`[ERROR] ${e}`));
    process.exit(1);
  }

  const {
    projectId,
    sourceCollectionPath,
    datasetId,
    tableId,
    batchSize,
    queryCollectionGroup,
    datasetLocation,
    multiThreaded,
    useNewSnapshotQuerySyntax,
    useEmulator,
  } = config;

  if (useEmulator) {
    console.log("Using emulator");
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  }

  // Initialize Firebase
  // This uses applicationDefault to authenticate
  // Please see https://cloud.google.com/docs/authentication/production
  if (!firebase.apps.length) {
    firebase.initializeApp({
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }
  // Set project ID, so it can be used in BigQuery initialization
  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  const rawChangeLogName = `${tableId}_raw_changelog`;

  if (multiThreaded) return runMultiThread(config, rawChangeLogName);
  // We pass in the application-level "tableId" here. The tracker determines
  // the name of the raw changelog from this field.
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId: tableId,
    datasetId: datasetId,
    datasetLocation,
    wildcardIds: queryCollectionGroup,
    useNewSnapshotQuerySyntax,
  });

  console.log(
    `Importing data from Cloud Firestore Collection${
      queryCollectionGroup ? " (via a Collection Group query)" : ""
    }: ${sourceCollectionPath}, to BigQuery Dataset: ${datasetId}, Table: ${rawChangeLogName}`
  );

  // Build the data row with a 0 timestamp. This ensures that all other
  // operations supersede imports when listing the live documents.
  let cursor;

  const formattedPath = filenamify(sourceCollectionPath);

  let cursorPositionFile =
    __dirname +
    `/from-${formattedPath}-to-${projectId}_${datasetId}_${rawChangeLogName}`;
  if (await exists(cursorPositionFile)) {
    let cursorDocumentId = (await read(cursorPositionFile)).toString();
    cursor = await firebase.firestore().doc(cursorDocumentId).get();
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

    query = query.limit(batchSize);

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
        timestamp: new Date().toISOString(), // epoch
        operation: ChangeType.IMPORT,
        documentName: `projects/${projectId}/databases/${FIRESTORE_DEFAULT_DATABASE}/documents/${snapshot.ref.path}`,
        documentId: snapshot.id,
        pathParams: resolveWildcardIds(sourceCollectionPath, snapshot.ref.path),
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
    console.log(e);
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

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
import { runMultiThread } from "./run-multi-thread";
import { runSingleThread } from "./run-single-thread";
import * as logs from "./logs";
import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { parseConfig } from "./config";
import { initializeDataSink } from "./helper";
// For reading cursor position.
const exists = util.promisify(fs.exists);
const write = util.promisify(fs.writeFile);
const read = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);
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
    "-q, --query-collection-group [true|false]",
    "Use 'true' for a collection group query, otherwise a collection query is performed."
  )
  .option(
    "-s, --source-collection-path <source-collection-path>",
    "The path of the the Cloud Firestore Collection to import from. (This may or may not be the same Collection for which you plan to mirror changes.)"
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
    datasetId,
    tableId,
    queryCollectionGroup,
    datasetLocation,
    multiThreaded,
    useNewSnapshotQuerySyntax,
    useEmulator,
    cursorPositionFile,
  } = config;
  if (useEmulator) {
    console.log("Using emulator");
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
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
  // We pass in the application-level "tableId" here. The tracker determines
  // the name of the raw changelog from this field.
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId: tableId,
    datasetId: datasetId,
    datasetLocation,
    wildcardIds: queryCollectionGroup,
    useNewSnapshotQuerySyntax,
  });

  // TODO: do we even need this logic?
  // await initializeDataSink(dataSink, config);

  logs.importingData(config);
  if (multiThreaded && queryCollectionGroup) {
    if (queryCollectionGroup) {
      return runMultiThread(config);
    }
    logs.warningMultiThreadedCollectionGroupOnly();
  }

  // Build the data row with a 0 timestamp. This ensures that all other
  // operations supersede imports when listing the live documents.
  let cursor:
    | firebase.firestore.DocumentSnapshot<firebase.firestore.DocumentData>
    | undefined = undefined;

  if (await exists(cursorPositionFile)) {
    let cursorDocumentId = (await read(cursorPositionFile)).toString();
    cursor = await firebase.firestore().doc(cursorDocumentId).get();
    logs.resumingImport(config, cursorDocumentId);
  }
  const totalRowsImported = runSingleThread(dataSink, config, cursor);
  try {
    await unlink(cursorPositionFile);
  } catch (e) {
    logs.warningUnlinkingJournalFile(cursorPositionFile, e);
  }
  return totalRowsImported;
};

run()
  .then((rowCount) => {
    logs.finishedImporting(rowCount);
    process.exit();
  })
  .catch((error) => {
    logs.errorImporting(error);
    process.exit(1);
  });

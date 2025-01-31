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
import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import * as fs from "fs";
import * as util from "util";

import { parseConfig } from "./config";
import { initializeDataSink } from "./helper";
import * as logs from "./logs";
import { getCLIOptions } from "./program";
import { runMultiThread } from "./run-multi-thread";
import { runSingleThread } from "./run-single-thread";

// For reading cursor position.
const exists = util.promisify(fs.exists);
const read = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);
getCLIOptions();
const run = async (): Promise<number> => {
  const config = await parseConfig();
  if (config.kind === "ERROR") {
    config.errors?.forEach((e) => console.error(`[ERROR] ${e}`));
    process.exit(1);
  }
  const {
    projectId,
    bigQueryProjectId,
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
  // Set project ID, so it can be used in BigQuery initialization
  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.GCLOUD_PROJECT = projectId;

  // Initialize Firebase
  // This uses applicationDefault to authenticate
  // Please see https://cloud.google.com/docs/authentication/production
  if (!firebase.apps.length) {
    firebase.initializeApp({
      projectId: projectId,
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }

  // We pass in the application-level "tableId" here. The tracker determines
  // the name of the raw changelog from this field.
  // TODO: fix this type, it should include clustering apparently
  // @ts-expect-error
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId: tableId,
    datasetId: datasetId,
    datasetLocation,
    wildcardIds: queryCollectionGroup,
    useNewSnapshotQuerySyntax,
    bqProjectId: bigQueryProjectId,
    transformFunction: config.transformFunctionUrl,
  });

  await initializeDataSink(dataSink, config);

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

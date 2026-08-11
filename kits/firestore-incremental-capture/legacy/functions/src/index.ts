/**
 * Copyright 2023 Google LLC
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

import * as functions from "firebase-functions";

import config from "./config";

import { syncDataHandler } from "./tasks/on_sync_data_handler";
import { onCompleteHandler } from "./dataflow/on_complete_handler";
import { syncDataTaskHandler } from "./tasks/sync_data_task_handler";
import { buildFlexTemplateHandler } from "./dataflow/build_flex_template";
import { onBackupRestoreHandler } from "./tasks/on_backup_restore_handler";
import { runInitialSetupHandler } from "./tasks/on_run_initial_setup_handler";
import { onHttpRunRestorationHandler } from "./tasks/on_http_run_restoration_handler";
import { onFirestoreBackupInitHandler } from "./tasks/on_firestore_backup_init_handler";

/**
 * Sync data to BigQuery, triggered by any change to a Firestore document
 * */
export const syncData = functions.firestore
  .document(config.syncCollectionPath)
  .onWrite(syncDataHandler);

/**
 * Cloud task to handle data sync
 * */
export const syncDataTask = functions.tasks
  .taskQueue()
  .onDispatch(syncDataTaskHandler);

/**
 * Backup the entire database on initial deployment
 * */
export const runInitialSetup = async () => await runInitialSetupHandler();

/**
 * Run a backup restoration.
 * */
export const onHttpRunRestoration = functions.https.onRequest(
  onHttpRunRestorationHandler
);

export const onBackupRestore = functions.tasks
  .taskQueue()
  .onDispatch(onBackupRestoreHandler);

/**
 * Cloud task for handling database restoration
 * */
export const onFirestoreBackupInit = functions.tasks
  .taskQueue()
  .onDispatch(onFirestoreBackupInitHandler);

/**
 * Cloud task for staging the dataflow template
 * */
export const buildFlexTemplate = functions.tasks
  .taskQueue()
  .onDispatch(buildFlexTemplateHandler);

export const onCloudBuildComplete =
  functions.https.onRequest(onCompleteHandler);

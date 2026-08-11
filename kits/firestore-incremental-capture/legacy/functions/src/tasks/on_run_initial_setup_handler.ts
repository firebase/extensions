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

import { getExtensions } from "firebase-admin/extensions";

import config from "../config";

import { initialize } from "../utils/big_query";
import { bqBackupSchema } from "../constants/bq_backup_schema";

export async function runInitialSetupHandler() {
  // Setup runtime
  const runtime = getExtensions().runtime();

  await runtime.setProcessingState(
    "NONE",
    `Creating/updating dataset and table ${config.bqDataset}.${config.bqtable}`
  );

  // Setup sync dataset and tables
  const [syncDataset, syncTable] = await initialize(
    config.bqDataset,
    config.bqtable,
    bqBackupSchema
  );

  return runtime.setProcessingState(
    "PROCESSING_COMPLETE",
    `Initialized dataset and table ${syncDataset.id}.${syncTable.id}`
  );
}

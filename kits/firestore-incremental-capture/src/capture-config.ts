/*
 * Copyright 2026 Google LLC
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

/** Log verbosity accepted by the kit. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/**
 * Configuration as supplied by a caller. Only the fields without a sensible
 * default are required; {@link resolveCaptureConfig} fills in the rest.
 */
export interface CaptureConfig {
  /** GCP project holding the Firestore databases, BigQuery dataset and jobs. */
  projectId: string;
  /**
   * Collection to capture, relative to the database root. `{document=**}`
   * captures every collection.
   */
  syncCollectionPath: string;
  /** Firestore database captured from. Defaults to `(default)`. */
  databaseId?: string;
  /**
   * Firestore database restored into. Must already exist and must not be the
   * captured database - a restoration batch-writes over its contents.
   */
  backupInstanceId: string;
  /** BigQuery dataset holding the changelog table. */
  datasetId: string;
  /** BigQuery changelog table. */
  tableId: string;
  /** BigQuery dataset location. Defaults to `us`. */
  datasetLocation?: string;
  /** Region the functions are deployed to. Defaults to `us-central1`. */
  location?: string;
  /** Region Dataflow jobs run in. Defaults to {@link CaptureConfig.location}. */
  dataflowRegion?: string;
  /**
   * Cloud Storage bucket holding the Dataflow flex template. Defaults to
   * `<projectId>.firebasestorage.app`, the default bucket for projects created
   * after September 2024. Projects older than that use `<projectId>.appspot.com`
   * and must set this explicitly.
   */
  bucketName?: string;
  /**
   * Namespaces the deployed resources: the task queues, the flex template
   * object, the Dataflow job names and the Firestore status documents. Deploy
   * the kit twice under one project by giving each deployment its own value.
   * Defaults to `firestore-incremental-capture`.
   */
  instanceId?: string;
  /** Defaults to `info`. */
  logLevel?: LogLevel;
}

/** {@link CaptureConfig} with every default applied and paths derived. */
export interface ResolvedCaptureConfig
  extends Required<Omit<CaptureConfig, "dataflowRegion" | "bucketName">> {
  dataflowRegion: string;
  bucketName: string;
  /** Fully-qualified name of the database restored into. */
  backupInstanceName: string;
  /**
   * Cloud Storage path of the Dataflow flex template spec. Built out-of-band by
   * the setup script, which must write to this exact path.
   */
  flexTemplatePath: string;
  /** Firestore document tracking the state of each restoration run. */
  restoreCollection: string;
}

const DEFAULT_DATABASE_ID = "(default)";
const DEFAULT_INSTANCE_ID = "firestore-incremental-capture";
const DEFAULT_LOCATION = "us-central1";
const DEFAULT_DATASET_LOCATION = "us";

/**
 * Applies defaults and derives the resource paths the handlers need.
 *
 * @param config - Caller-supplied configuration.
 * @returns The fully resolved configuration.
 * @throws If the backup database is the same as the captured database, which
 *   would make a restoration overwrite the source it is restoring from.
 */
export function resolveCaptureConfig(
  config: CaptureConfig
): ResolvedCaptureConfig {
  const databaseId = config.databaseId || DEFAULT_DATABASE_ID;
  const location = config.location || DEFAULT_LOCATION;
  const instanceId = config.instanceId || DEFAULT_INSTANCE_ID;
  const bucketName =
    config.bucketName || `${config.projectId}.firebasestorage.app`;

  if (config.backupInstanceId === databaseId) {
    throw new Error(
      `Invalid configuration for firestore-incremental-capture: BACKUP_INSTANCE_ID ` +
        `("${config.backupInstanceId}") must differ from the captured database ` +
        `("${databaseId}"). A restoration batch-writes over the backup database.`
    );
  }

  return {
    projectId: config.projectId,
    syncCollectionPath: config.syncCollectionPath,
    databaseId,
    backupInstanceId: config.backupInstanceId,
    datasetId: config.datasetId,
    tableId: config.tableId,
    datasetLocation: config.datasetLocation || DEFAULT_DATASET_LOCATION,
    location,
    dataflowRegion: config.dataflowRegion || location,
    bucketName,
    instanceId,
    logLevel: config.logLevel || "info",
    backupInstanceName: `projects/${config.projectId}/databases/${config.backupInstanceId}`,
    flexTemplatePath: `gs://${bucketName}/${instanceId}-dataflow-restore`,
    restoreCollection: `_${instanceId}/runs/restorations`,
  };
}

/**
 * Collection id the Dataflow pipeline reads from. The pipeline takes `*` to
 * mean every collection, where the Firestore trigger spells that `{document=**}`.
 *
 * @param syncCollectionPath - The configured collection path.
 * @returns The collection id in the pipeline's spelling.
 */
export function toPipelineCollectionId(syncCollectionPath: string): string {
  return syncCollectionPath === "{document=**}" ? "*" : syncCollectionPath;
}

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
   * Cloud Storage bucket holding the Dataflow flex template. Required, and not
   * guessed: the default bucket is `<projectId>.firebasestorage.app` for
   * projects created after September 2024 and `<projectId>.appspot.com` for
   * older ones, and guessing wrong means restoration launches against a
   * template that is not there. The entry point fills this from the project's
   * actual default bucket when the `BUCKET_NAME` param is unset.
   */
  bucketName: string;
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
  extends Required<Omit<CaptureConfig, "dataflowRegion">> {
  dataflowRegion: string;
  /**
   * Database the changes are captured from. Always `(default)`: the restoration
   * pipeline reads its PITR baseline from `FirestoreOptions.getDefaultInstance()`
   * (`RestorationPipeline.java`), so a non-default source would be captured to
   * the changelog but silently absent from the restored baseline.
   */
  databaseId: "(default)";
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

/** The only database the restoration pipeline can read a PITR baseline from. */
const SOURCE_DATABASE_ID = "(default)";
const DEFAULT_INSTANCE_ID = "firestore-incremental-capture";
const DEFAULT_LOCATION = "us-central1";
const DEFAULT_DATASET_LOCATION = "us";

/**
 * Applies defaults and derives the resource paths the handlers need.
 *
 * @param config - Caller-supplied configuration.
 * @returns The fully resolved configuration.
 * @throws If `backupInstanceId` is empty or is the captured database, either of
 *   which would make a restoration write over the source it restores from; or if
 *   `bucketName` is empty, which would leave the flex template path unresolvable.
 */
export function resolveCaptureConfig(
  config: CaptureConfig
): ResolvedCaptureConfig {
  const location = config.location || DEFAULT_LOCATION;
  const instanceId = config.instanceId || DEFAULT_INSTANCE_ID;

  const invalid = (detail: string): never => {
    throw new Error(
      `Invalid configuration for firestore-incremental-capture: ${detail}`
    );
  };

  if (!config.backupInstanceId) {
    invalid("BACKUP_INSTANCE_ID is required.");
  }

  if (config.backupInstanceId === SOURCE_DATABASE_ID) {
    invalid(
      `BACKUP_INSTANCE_ID ("${config.backupInstanceId}") must differ from the ` +
        `captured database ("${SOURCE_DATABASE_ID}"). A restoration batch-writes ` +
        `over the backup database.`
    );
  }

  if (!config.bucketName) {
    invalid(
      "BUCKET_NAME is required. It must name the bucket the Dataflow flex " +
        "template was staged to by scripts/setup.sh."
    );
  }

  const bucketName = config.bucketName;

  return {
    projectId: config.projectId,
    syncCollectionPath: config.syncCollectionPath,
    databaseId: SOURCE_DATABASE_ID,
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

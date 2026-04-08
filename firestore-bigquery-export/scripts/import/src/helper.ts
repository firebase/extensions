import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { BigQuery } from "@google-cloud/bigquery";

import { CliConfig } from "./types";

import {
  ChangeType,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import * as fs from "fs";
import * as util from "util";

import { resolveWildcardIds } from "./config";

const FIRESTORE_DEFAULT_DATABASE = "(default)";

// TODO: do we need this logic?
export const initializeDataSink = async (
  dataSink: FirestoreBigQueryEventHistoryTracker,
  config: CliConfig
) => {
  const bigQueryProjectId = config.bigQueryProjectId;

  const bigquery = new BigQuery({ projectId: bigQueryProjectId });

  const dataset = bigquery.dataset(config.datasetId, {
    location: config.datasetLocation,
  });

  const table = dataset.table(config.rawChangeLogName);
  const [tableExists] = await table.exists();
  await dataSink.initialize();
  if (!tableExists) {
    console.log("Wait a few seconds for the dataset to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 5000, [])); // Wait for the dataset to initialize
  }
};

export function getRowsFromDocs(
  docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[],
  config: CliConfig
): FirestoreDocumentChangeEvent[] {
  let rows: FirestoreDocumentChangeEvent[] = [];

  const templateSegments = config.sourceCollectionPath.split("/");

  if (config.queryCollectionGroup && templateSegments.length > 1) {
    for (const doc of docs) {
      let pathParams = {};
      const path = doc.ref.path;

      const pathSegments = path.split("/");
      const isSameLength = pathSegments.length === templateSegments.length + 1;

      if (isSameLength) {
        let isMatch = true;
        for (let i = 0; i < templateSegments.length; i++) {
          if (
            templateSegments[i].startsWith("{") &&
            templateSegments[i].endsWith("}")
          ) {
            const key = templateSegments[i].substring(
              1,
              templateSegments[i].length - 1
            );
            const value = pathSegments[i];
            pathParams = {
              ...pathParams,
              [key]: value,
            };
          } else if (templateSegments[i] !== pathSegments[i]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          rows.push({
            timestamp: new Date().toISOString(), // epoch
            operation: ChangeType.IMPORT,
            documentName: `projects/${config.projectId}/databases/${FIRESTORE_DEFAULT_DATABASE}/documents/${path}`,
            documentId: doc.id,
            // TODO: fix this type
            // @ts-expect-error
            pathParams,
            eventId: "",
            data: doc.data(),
          });
        }
      }
    }
  } else {
    // TODO: fix this type
    // @ts-expect-error
    rows = docs.map((snapshot) => {
      return {
        timestamp: new Date().toISOString(), // epoch
        operation: ChangeType.IMPORT,
        documentName: `projects/${config.projectId}/databases/${FIRESTORE_DEFAULT_DATABASE}/documents/${snapshot.ref.path}`,
        documentId: snapshot.id,
        pathParams: resolveWildcardIds(
          config.sourceCollectionPath,
          snapshot.ref.path
        ),
        eventId: "",
        data: snapshot.data(),
      };
    });
  }
  return rows;
}

const appendFile = util.promisify(fs.appendFile);

/**
 * Initializes or resets the failed batch output file.
 * If a file already exists at the specified path, it will be deleted and recreated.
 * This ensures we start with a clean file for each import operation.
 *
 * @param failedBatchOutputPath - Path where failed batch information should be stored
 *                               If undefined, the function returns early (no file operations)
 * @throws Error if file deletion fails
 */
export async function initializeFailedBatchOutput(
  failedBatchOutputPath?: string
) {
  if (!failedBatchOutputPath) return;

  // Delete existing file if present
  // This prevents append operations from mixing old and new failed files
  if (fs.existsSync(failedBatchOutputPath)) {
    try {
      await fs.promises.unlink(failedBatchOutputPath);
      console.log(`${failedBatchOutputPath} was deleted successfully.`);
    } catch (err) {
      throw new Error(`Error deleting ${failedBatchOutputPath}: ${err}`);
    }
  }

  // Create a new empty file
  // This ensures the file exists before any append operations
  await fs.promises.writeFile(failedBatchOutputPath, "", "utf8");
}

/**
 * Records a failed batch of documents to the output file.
 * Each document's path is written on a new line for easy parsing.
 * Failed batches are appended to the file, preserving previous failures.
 *
 * @param failedBatchOutputPath - Path to the file where failed batches should be recorded
 *                               If undefined, the function returns early (no recording)
 * @param docs - Array of Firestore documents that failed to import
 *              Their paths will be extracted and recorded
 */
export async function recordFailedBatch(
  failedBatchOutputPath: string | undefined,
  docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]
) {
  if (!failedBatchOutputPath) return;

  try {
    // Convert document array to newline-separated paths
    // Add final newline to maintain one-path-per-line format
    await appendFile(
      failedBatchOutputPath,
      docs.map((d) => d.ref.path).join("\n") + "\n"
    );
  } catch (error) {
    console.error(`Error writing to failed batch file: ${error}`);
  }
}

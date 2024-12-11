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

const write = util.promisify(fs.writeFile);

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

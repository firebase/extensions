import * as firebase from "firebase-admin";
import {
  ChangeType,
  // FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import { resolveWildcardIds } from "./config";
import { CliConfig } from "./types";
import * as fs from "fs";
import * as util from "util";
const exists = util.promisify(fs.exists);
const write = util.promisify(fs.writeFile);
const read = util.promisify(fs.readFile);
const unlink = util.promisify(fs.unlink);
import * as filenamify from "filenamify";
import * as logs from "./logs";
import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
const FIRESTORE_DEFAULT_DATABASE = "(default)";

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
            pathParams,
            eventId: "",
            data: doc.data(),
          });
        }
      }
    }
  } else {
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

export function getQuery(
  config: CliConfig,
  cursor?: firebase.firestore.DocumentSnapshot<firebase.firestore.DocumentData>
): firebase.firestore.Query {
  const { sourceCollectionPath, batchSize, queryCollectionGroup } = config;

  let collectionOrCollectionGroup:
    | firebase.firestore.CollectionGroup
    | firebase.firestore.CollectionReference;
  if (queryCollectionGroup) {
    collectionOrCollectionGroup = firebase
      .firestore()
      .collectionGroup(
        sourceCollectionPath.split("/")[
          sourceCollectionPath.split("/").length - 1
        ]
      );
  } else {
    collectionOrCollectionGroup = firebase
      .firestore()
      .collection(sourceCollectionPath);
  }

  let query = collectionOrCollectionGroup.limit(batchSize);
  if (cursor) {
    query = query.startAfter(cursor);
  }
  return query;
}

export async function runSingleThread(
  dataSink: FirestoreBigQueryEventHistoryTracker,
  config: CliConfig,
  cursor:
    | firebase.firestore.DocumentSnapshot<firebase.firestore.DocumentData>
    | undefined
) {
  let totalRowsImported = 0;

  while (true) {
    if (cursor) {
      await write(config.cursorPositionFile, cursor.ref.path);
    }

    let query = getQuery(config, cursor);

    const snapshot = await query.get();

    const docs = snapshot.docs;

    if (docs.length === 0) {
      break;
    }
    cursor = docs[docs.length - 1];

    const rows: FirestoreDocumentChangeEvent[] = getRowsFromDocs(docs, config);

    await dataSink.record(rows);
    totalRowsImported += rows.length;
  }
  return totalRowsImported;
}

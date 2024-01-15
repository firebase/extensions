import {
  ChangeType,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import * as fs from "fs";
import * as util from "util";

import { getRowsFromDocs } from "./helper";
import { CliConfig } from "./types";

const write = util.promisify(fs.writeFile);
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
    console.log("\x1b[36m%s\x1b[0m", "HERE 1.75"); //cyan
    collectionOrCollectionGroup = firebase
      .firestore()
      .collection(sourceCollectionPath);
  }

  let query = collectionOrCollectionGroup.limit(batchSize);
  if (cursor) {
    console.log("\x1b[36m%s\x1b[0m", "we have cursor"); //cyan
    query = query.startAfter(cursor);
  }
  console.log("\x1b[36m%s\x1b[0m", `QUERY: ${JSON.stringify(query)}`); //cyan
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

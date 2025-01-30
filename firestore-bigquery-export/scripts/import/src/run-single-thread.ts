import {
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import * as fs from "fs";
import * as util from "util";

import { getRowsFromDocs } from "./helper";
import { CliConfig } from "./types";

const write = util.promisify(fs.writeFile);
const appendFile = util.promisify(fs.appendFile);

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

  if (config.failedBatchOutput) {
    // delete failed output  file if it exists
    if (fs.existsSync(config.failedBatchOutput)) {
      fs.unlink(config.failedBatchOutput, (err) => {
        if (err) {
          throw new Error(`Error deleting ${config.failedBatchOutput}: ${err}`);
        } else {
          console.log(`${config.failedBatchOutput} was deleted successfully.`);
        }
      });
    }
    // Initialize failed batch text file
    fs.writeFileSync(config.failedBatchOutput, "", "utf8"); // Clear file content
  }

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

    try {
      await dataSink.record(rows);
      totalRowsImported += rows.length;
    } catch (error) {
      console.error(`Error processing batch: ${error}`);
      console.error(`Failed batch: ${docs.map((d) => d.ref.path).join("\n")}`);
      if (config.failedBatchOutput) {
        await appendFile(
          config.failedBatchOutput,
          docs.map((d) => d.ref.path).join("\n") + "\n"
        );
      }
    }
  }

  return totalRowsImported;
}

import {
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import * as fs from "fs";
import { worker } from "workerpool";
import { getRowsFromDocs } from "./helper";
import { CliConfig, SerializableQuery } from "./types";

const appendFile = fs.promises.appendFile;

async function processDocuments(
  serializableQuery: SerializableQuery,
  config: CliConfig
) {
  const {
    sourceCollectionPath,
    projectId,
    tableId,
    datasetId,
    datasetLocation,
    batchSize,
    failedBatchOutput,
  } = config;

  if (!firebase.apps.length) {
    firebase.initializeApp({
      projectId: projectId,
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }

  let query = firebase
    .firestore()
    .collectionGroup(sourceCollectionPath.split("/").pop()!)
    .orderBy(firebase.firestore.FieldPath.documentId(), "asc");

  if (serializableQuery.startAt?.values?.[0]?.referenceValue) {
    const startPath = serializableQuery.startAt.values[0].referenceValue;
    query = query.startAt(firebase.firestore().doc(startPath));
  }
  if (serializableQuery.endAt?.values?.[0]?.referenceValue) {
    const endPath = serializableQuery.endAt.values[0].referenceValue;
    query = query.endBefore(firebase.firestore().doc(endPath));
  }
  if (serializableQuery.offset) {
    query = query.offset(serializableQuery.offset);
  }

  let lastDocumentSnapshot = null;
  let totalProcessed = 0;
  // @ts-expect-error
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId,
    datasetId,
    datasetLocation,
    wildcardIds: true,
    skipInit: true,
    useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
  });

  while (true) {
    let batchQuery = query;
    if (lastDocumentSnapshot)
      batchQuery = batchQuery.startAfter(lastDocumentSnapshot);
    batchQuery = batchQuery.limit(batchSize);

    const { docs } = await batchQuery.get();
    if (docs.length === 0) break;

    lastDocumentSnapshot = docs[docs.length - 1];

    console.log(
      `Processing batch of ${docs.length} docs: ${docs[0].ref.path} -> ${
        docs[docs.length - 1].ref.path
      }`
    );

    const rows: FirestoreDocumentChangeEvent[] = getRowsFromDocs(docs, config);

    try {
      await dataSink.record(rows);
      totalProcessed += rows.length;
      console.log(`Processed ${rows.length} matching documents in this batch`);
    } catch (error) {
      console.error(`Error processing batch in worker: ${error}`);

      // Log failed batch to JSON file safely
      const failedBatch = {
        documents: docs.map((d) => d.ref.path),
      };
      if (failedBatchOutput) {
        // Ensure JSON integrity in a multi-threaded environment
        try {
          await appendFile(
            failedBatchOutput,
            JSON.stringify(failedBatch, null, 2) + ",\n"
          );
        } catch (fsError) {
          console.error(`Error writing to failed batch file: ${fsError}`);
        }
      }
    }

    // If we've reached the partition boundary, break
    const lastDocId = lastDocumentSnapshot.id;
    if (serializableQuery.endAt?.values?.[0]?.referenceValue) {
      const endAtRef = serializableQuery.endAt.values[0].referenceValue;
      const endAtId = endAtRef.split("/").pop();
      if (lastDocId >= endAtId) {
        break;
      }
    }
  }

  console.log(
    `Worker completed. Processed ${totalProcessed} matching documents`
  );
  return totalProcessed;
}

worker({ processDocuments });

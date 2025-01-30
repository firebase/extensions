import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import { worker } from "workerpool";
import { getRowsFromDocs } from "./helper";

import { CliConfig, QueryOptions, SerializableQuery } from "./types";

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
  } = config;

  if (!firebase.apps.length) {
    firebase.initializeApp({
      projectId: projectId,
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }

  // Create base query
  let query = firebase
    .firestore()
    .collectionGroup(
      sourceCollectionPath.split("/")[
        sourceCollectionPath.split("/").length - 1
      ]
    )
    .orderBy(firebase.firestore.FieldPath.documentId(), "asc");

  // Apply the serialized query constraints
  if (serializableQuery.startAt?.values?.[0]?.referenceValue) {
    const startPath = serializableQuery.startAt.values[0].referenceValue;
    const docRef = firebase
      .firestore()
      .doc(
        startPath.replace(
          "projects/" + projectId + "/databases/(default)/documents/",
          ""
        )
      );
    query = query.startAt(docRef);
  }
  if (serializableQuery.endAt?.values?.[0]?.referenceValue) {
    const endPath = serializableQuery.endAt.values[0].referenceValue;
    const docRef = firebase
      .firestore()
      .doc(
        endPath.replace(
          "projects/" + projectId + "/databases/(default)/documents/",
          ""
        )
      );
    // Use endBefore to prevent overlap
    query = query.endBefore(docRef);
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

    if (lastDocumentSnapshot) {
      batchQuery = batchQuery.startAfter(lastDocumentSnapshot);
    }

    batchQuery = batchQuery.limit(batchSize);
    const { docs } = await batchQuery.get();

    if (docs.length === 0) {
      break;
    }

    lastDocumentSnapshot = docs[docs.length - 1];

    // Log the batch range for debugging
    console.log(
      `Processing batch of ${docs.length} docs: ${docs[0].ref.path} -> ${
        docs[docs.length - 1].ref.path
      }`
    );

    // Get matching rows
    const rows: FirestoreDocumentChangeEvent[] = getRowsFromDocs(docs, config);

    // Only try to record if we have matching rows
    if (rows.length > 0) {
      await dataSink.record(rows);
      totalProcessed += rows.length;
      console.log(`Processed ${rows.length} matching documents in this batch`);
    } else {
      console.log(
        "No matching documents in this batch, continuing to next batch"
      );
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

worker({
  processDocuments: processDocuments,
});

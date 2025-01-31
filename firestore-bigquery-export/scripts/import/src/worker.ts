import {
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as firebase from "firebase-admin";
import { worker } from "workerpool";
import { getRowsFromDocs, recordFailedBatch } from "./helper";
import { CliConfig, SerializableQuery } from "./types";

/**
 * Processes a partition of documents from Firestore and imports them into BigQuery.
 * This function runs in a worker thread and handles a subset of the total documents
 * to enable parallel processing.
 *
 * @param serializableQuery - Query parameters defining the partition boundaries
 * @param config - Configuration for Firestore and BigQuery connections
 * @returns The total number of documents processed successfully
 */
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

  // Initialize Firebase Admin SDK if not already initialized in this worker
  if (!firebase.apps.length) {
    firebase.initializeApp({
      projectId: projectId,
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }

  // Construct base query for the collection group
  // Using collectionGroup allows querying across all collections with the same ID
  let query = firebase
    .firestore()
    .collectionGroup(sourceCollectionPath.split("/").pop()!)
    .orderBy(firebase.firestore.FieldPath.documentId(), "asc");

  // Apply partition boundaries from the serialized query
  // These define the range of documents this worker should process
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

  // Initialize BigQuery data sink
  // skipInit: true because the main thread handles initialization
  // @ts-expect-error
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId,
    datasetId,
    datasetLocation,
    wildcardIds: true,
    skipInit: true,
    useNewSnapshotQuerySyntax: config.useNewSnapshotQuerySyntax,
    transformFunction: config.transformFunctionUrl,
  });

  // Process documents in batches until we've covered the entire partition
  while (true) {
    // Create query for next batch, starting after the last processed document
    let batchQuery = query;
    if (lastDocumentSnapshot)
      batchQuery = batchQuery.startAfter(lastDocumentSnapshot);
    batchQuery = batchQuery.limit(batchSize);

    // Fetch the next batch of documents
    const { docs } = await batchQuery.get();
    if (docs.length === 0) break; // No more documents to process

    // Update cursor to last document in batch
    lastDocumentSnapshot = docs[docs.length - 1];

    console.log(
      `Processing batch of ${docs.length} docs: ${docs[0].ref.path} -> ${
        docs[docs.length - 1].ref.path
      }`
    );

    // Convert Firestore documents to BigQuery row format, get path_params from wildcards
    // filter out to match wildcard path pattern
    const rows: FirestoreDocumentChangeEvent[] = getRowsFromDocs(docs, config);

    try {
      // Write batch to BigQuery
      await dataSink.record(rows);
      totalProcessed += rows.length;
      console.log(`Processed ${rows.length} matching documents in this batch`);
    } catch (error) {
      // Handle failed batches by logging and recording them for retry
      console.error(`Error processing batch in worker: ${error}`);
      console.error(`Failed batch: ${docs.map((d) => d.ref.path).join("\n")}`);
      await recordFailedBatch(failedBatchOutput, docs);
    }

    // Check if we've reached the end of our assigned partition
    // This prevents processing documents that belong to other workers
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

// Register this file as a worker with workerpool
// This makes the processDocuments function available to be called from the main thread
worker({ processDocuments });

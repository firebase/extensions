import { cpus } from "os";
import * as firebase from "firebase-admin";
import { pool } from "workerpool";

import { CliConfig } from "./types";
import { parseConfig } from "./config";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";

/**
 * Import data from a collection group in parrallel using workers.
 */
async function processCollectionGroup(config: CliConfig): Promise<number> {
  const maxWorkers = Math.ceil(cpus().length / 2);
  const workerPool = pool(__dirname + "/worker.js", {
    maxWorkers,
    forkOpts: {
      env: {
        PROJECT_ID: config.projectId,
        GOOGLE_CLOUD_PROJECT: config.projectId,
        GCLOUD_PROJECT: config.projectId,
        ...process.env,
      },
    },
  });

  const query = firebase
    .firestore()
    .collectionGroup(config.sourceCollectionPath);

  const partitionsList = query.getPartitions(config.batchSize);

  let total = 0;
  let partitions = 0;

  while (true) {
    const inProgressTasks =
      workerPool.stats().activeTasks + workerPool.stats().pendingTasks;
    if (inProgressTasks >= maxWorkers) {
      // A timeout is needed here to stop infinite rechecking of workpool.stats().
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }

    // @ts-ignore, iterator not typed correctly.
    const { value: partition, done } = await partitionsList.next();
    if (done || !partition) {
      break;
    }

    partitions++;

    const query = partition.toQuery();

    const serializedQuery = {
      startAt: query._queryOptions.startAt,
      endAt: query._queryOptions.endAt,
      limit: query._queryOptions.limit,
      offset: query._queryOptions.offset,
    };

    workerPool
      .exec("processDocuments", [serializedQuery, config])
      .then((count) => {
        total += count;
        console.log(`${total} documents processed`);
      })
      .catch((error) => {
        // TODO handle, what should happen on error?
        console.error(error);
        process.exit(1);
      });
  }

  // Wait for all tasks to be complete.
  while (workerPool.stats().activeTasks + workerPool.stats().pendingTasks > 0) {
    // Return a default promise
    // A timeout is needed here to stop infinite rechecking of workpool.stats().
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await workerPool.terminate();

  console.log(`Imported ${total} documents in ${partitions} partitions.`);

  console.log("---------------------------------------------------------");
  console.log(
    `Please see https://console.cloud.google.com/bigquery?p=${
      config.projectId
    }&d=${config.datasetId}&t=${config.tableId}_raw_changelog&page=table`
  );
  console.log("---------------------------------------------------------");

  return Promise.resolve(total);
}

/**
 * Batch import data from a collection.
 */
async function processCollection(config: CliConfig): Promise<number> {
  let total = 0;
  let batches = 0;
  let lastDocument = null;
  let lastBatchSize: number = config.batchSize;

  while (lastBatchSize == config.batchSize) {
    batches++;
    let query = firebase
      .firestore()
      .collection(config.sourceCollectionPath)
      .limit(config.batchSize);

    if (lastDocument != null) {
      query = query.startAfter(lastDocument);
    }

    const snapshot = await query.get();
    const { docs } = snapshot;

    const dataSink = new FirestoreBigQueryEventHistoryTracker({
      tableId: config.tableId,
      datasetId: config.datasetId,
      datasetLocation: config.datasetLocation,
    });

    const rows: FirestoreDocumentChangeEvent = docs.map((document) => {
      return {
        timestamp: new Date(0).toISOString(),
        operation: ChangeType.IMPORT,
        documentName: `projects/${
          config.projectId
        }/databases/(default)/documents/${document.ref.path}`,
        documentId: document.id,
        eventId: "",
        data: document.data(),
      };
    });

    await dataSink.record(rows);

    if (docs.length) {
      lastDocument = docs[docs.length - 1];
    }
    lastBatchSize = docs.length;
    total += docs.length;
  }

  console.log(`Imported ${total} documents in ${batches} batches.`);

  return total;
}

export async function runMultiThread(): Promise<number> {
  const config: CliConfig = await parseConfig();
  const { projectId, queryCollectionGroup } = config; // No longer needed? collectionGroup handles both types?

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });

  // TODO ensure bq views and tables already exist otherwise first worker will error.
  // TODO ensure bq views and tables already exist otherwise first worker will error.
  // TODO ensure bq views and tables already exist otherwise first worker will error.
  // TODO ensure bq views and tables already exist otherwise first worker will error.

  // Set project ID so it can be used in BigQuery initialization
  process.env.PROJECT_ID = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  return queryCollectionGroup
    ? processCollectionGroup(config)
    : processCollection(config);
}

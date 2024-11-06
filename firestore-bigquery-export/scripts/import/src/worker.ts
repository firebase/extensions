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
  } = config;

  if (!firebase.apps.length) {
    // Initialize Firebase
    firebase.initializeApp({
      projectId: projectId,
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  }

  const query = firebase
    .firestore()
    .collectionGroup(
      sourceCollectionPath.split("/")[
        sourceCollectionPath.split("/").length - 1
      ]
    )
    .orderBy(firebase.firestore.FieldPath.documentId(), "asc") as QueryOptions;

  query._queryOptions.startAt = serializableQuery.startAt;
  query._queryOptions.endAt = serializableQuery.endAt;
  query._queryOptions.limit = serializableQuery.limit;
  query._queryOptions.offset = serializableQuery.offset;

  const { docs } = await query.get();

  console.log(
    `worker got ${docs.length} docs, starting at ${docs[0].id} and ending at ${
      docs[docs.length - 1].id
    }`
  );
  // TODO: fix this type. I think these parameters might need to be optional.
  // @ts-expect-error
  const dataSink = new FirestoreBigQueryEventHistoryTracker({
    tableId,
    datasetId,
    datasetLocation,
  });
  // TODO: fix type
  // @ts-expect-error
  const rows: FirestoreDocumentChangeEvent = getRowsFromDocs(docs, config);

  // TODO: fix type
  // @ts-expect-error
  await dataSink.record(rows);
  // TODO: fix type
  // @ts-expect-error
  return rows.length;
}

worker({
  processDocuments: processDocuments,
});

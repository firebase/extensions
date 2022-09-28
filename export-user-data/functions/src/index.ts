/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as csvStringify from "csv-stringify/sync";

const STORAGE_BUCKET = "storage-bucket";
const STORAGE_EXPORT_DIRECTORY = "exports";
const PATHS_FROM_CONFIG = "users/{UID},posts/{UID}";
const HEADERS = ["TYPE", "path", "data"];

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const getPaths = (uid: string) => {
  const paths = PATHS_FROM_CONFIG.split(",").map((path) =>
    path.replace(/{UID}/g, uid)
  );

  const collections: string[] = [];
  const docs: string[] = [];

  for (let path of paths) {
    const parts = path.split("/");
    if (parts.length % 2 === 0) {
      docs.push(path);
    } else {
      collections.push(path);
    }
  }

  return {
    collections,
    docs,
  };
};

const uploadToStorage = async (
  csv: string,
  uid: string,
  exportId: string,
  path: string
) => {
  const formattedPath = path.replace(/\//g, "_");

  const storagePath = `${STORAGE_EXPORT_DIRECTORY}/${uid}/${exportId}/${formattedPath}.csv`;

  const file = admin
    .storage()
    .bucket(STORAGE_BUCKET)
    .file(storagePath);

  await file.save(csv);

  await admin
    .firestore()
    .doc(`exports/${exportId}`)
    .update({
      status: "complete",
      storagePath: storagePath,
    });

  return storagePath;
};

const initializeExport = async (uid: string, startedAt) => {
  const exportDoc = await admin
    .firestore()
    .collection("exports")
    .add({
      uid,
      status: "pending",
      started_at: startedAt,
    });

  return exportDoc.id;
};

const constructFirestoreCollectionCSV = async (
  snap: FirebaseFirestore.QuerySnapshot,
  collectionPath: string
) => {
  const csvData = snap.docs.map((doc) => {
    const path = `${collectionPath}/${doc.id}`;

    return ["FIRESTORE", path, JSON.stringify(doc.data())];
  });

  csvData.unshift(HEADERS);

  return csvStringify.stringify(csvData);
};

const constructFirestoreDocumentCSV = async (
  snap: FirebaseFirestore.DocumentSnapshot,
  documentPath: string
) => {
  const csvData = [HEADERS];

  const data = snap.data();

  for (let key in data) {
    const path = `${documentPath}/${key}`;
    csvData.push(["FIRESTORE", path, JSON.stringify(data[key])]);
  }

  return csvStringify.stringify(csvData);
};

export const exportUserData = functions.https.onCall(async (_data, context) => {
  const startedAt = admin.firestore.Timestamp.now();
  // const uid = context.auth.uid;
  const uid = "123";

  const exportId = await initializeExport(uid, startedAt);

  // get all paths we will export
  const { collections, docs } = getPaths(uid);

  const promises = [];

  for (let collection of collections) {
    const snap = await admin
      .firestore()
      .collection(collection)
      .get();

    if (!snap.empty) {
      const csv = await constructFirestoreCollectionCSV(snap, collection);
      promises.push(uploadToStorage(csv, uid, exportId, collection));
    }
  }

  for (let doc of docs) {
    const snap = await admin
      .firestore()
      .doc(doc)
      .get();

    if (snap.exists) {
      const csv = await constructFirestoreDocumentCSV(snap, doc);
      promises.push(uploadToStorage(csv, uid, exportId, doc));
    }
  }

  await Promise.all(promises);

  return { exportId };
});

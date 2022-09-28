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


const STORAGE_BUCKET = 'storage-bucket';
const STORAGE_EXPORT_DIRECTORY = "exports";

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const getPaths = (uid: string) => {
  const configParam = "users/{UID},posts/{UID}";

  const paths = configParam
    .split(",")
    .map((path) => path.replace(/{UID}/g, uid));

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

  await admin.firestore()
    .doc(`exports/${exportId}`)
    .update({
      status: "complete",
      storagePath: storagePath,
    })

  return storagePath
};

export const exportUserData = functions.https.onCall(async (_data, context) => {
  const startedAt = admin.firestore.Timestamp.now();
  // const uid = context.auth.uid;
  const uid = "123";

  // create /exports/<exportId> with status "pending"
  const ref = await admin
    .firestore()
    .collection("exports")
    .add({ status: "pending", started_at: startedAt, uid });

  const exportId = ref.id;

  // get all paths we will export
  const { collections, docs } = getPaths(uid);

  const headers = ["TYPE", "path", "data"];

  const promises = [];

  for (let collection of collections) {

    const snap = await admin
      .firestore()
      .collection(collection)
      .get();

    if (!snap.empty) {
      const csvData = snap.docs.map((doc => {

        const path = `${collection}/${doc.id}`;
        return ["FIRESTORE", path, JSON.stringify(doc.data())];
      }));

      csvData.unshift(headers);

      const csv = csvStringify.stringify(csvData);
      promises.push(uploadToStorage(csv, uid, exportId, collection));
    }
  }

  for (let doc of docs) {
    const csvData = [headers];
    const snap = await admin
      .firestore()
      .doc(doc)
      .get();
    if (snap.exists) {
      const data = snap.data();
      csvData.push(["FIRESTORE", doc, JSON.stringify(data)]);

      const csv = csvStringify.stringify(csvData);
      promises.push(uploadToStorage(csv, uid, exportId, doc));
    }
  }

  await Promise.all(promises);

  await admin
    .firestore()
    .collection("exports")
    .doc(exportId)
    .update({
      uid,
      started_at: startedAt,
      status: "complete",
      location: `gs://storage-bucket/exports/${uid}/${exportId}`,
      // TODO include links to export
    });

  // TODO return the storage refs
  return { exportId };
});

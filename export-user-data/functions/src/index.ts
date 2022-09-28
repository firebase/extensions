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
import * as archiver from "archiver";
import config from "./config";
import * as logs from "./logs";
import * as csvStringify from "csv-stringify/sync";

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

  const file = admin
    .storage()
    .bucket("storage-bucket")
    .file(`exports/${uid}/${exportId}/${formattedPath}`);

  return file.save(csv);
};

export const exportUserData = functions.https.onCall(async (_data, context) => {
  const startedAt = admin.firestore.Timestamp.now();
  // const uid = context.auth.uid;
  const uid = "123";

  // create /exports/<exportId> with status "pending"
  const ref = await admin
    .firestore()
    .collection("exports")
    .add({ status: "pending", started_at: startedAt });
  const exportId = ref.id;

  const file = admin
    .storage()
    .bucket("storage-bucket")
    .file("exports/" + uid + "/" + exportId + ".zip");

  // get all paths we will export
  const { collections, docs } = getPaths(uid);

  const headers = ["TYPE", "path", "data"];

  const promises = [];

  for (let collection of collections) {
    const csvData = [headers];
    const snap = await admin
      .firestore()
      .collection(collection)
      .get();

    if (!snap.empty) {
      const data = snap.docs.map((doc) => doc.data());
      csvData.push(["FIRESTORE", collection, JSON.stringify(data)]);

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

  await admin
    .firestore()
    .collection("exports")
    .doc(exportId)
    .update({
      uid,
      started_at: startedAt,
      status: "complete",
      // TODO include links to export
    });

  // TODO return the storage refs
  return { exportId };
});

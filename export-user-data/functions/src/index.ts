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

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

logs.init();

const pipeToStorage = (archive: any, exportId: string, uid: string) => {

  const file = admin
    .storage()
    .bucket('storage-bucket')
    .file('exports/' + uid + '/' + exportId + '.zip')


  const outputStreamBuffer = file.createWriteStream({
    gzip: true,
    contentType: 'application/zip',
  });

  archive.pipe(outputStreamBuffer);


}

export const exportUserData = functions.https.onCall(async (_data, context) => {

  const uid = context.auth.uid;

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', function (err: unknown) {
    throw err;
  });

  archive.on("finish", async () => {
    console.log("Archive created");
  })

  // create /exports/<exportId> with status "pending"
  const ref = await admin.firestore().collection('exports').add({ status: 'pending' })
  const exportId = ref.id;

  pipeToStorage(archive, exportId, uid);


  // get firestore paths to export
  const { firestoreExportCollectionPaths } = config;
  // make CSV for each path
  const exportedDocs = [];

  for (let path of firestoreExportCollectionPaths.split(',')) {
    const pathWithUid = path.replace(/{UID}/g, uid);
    // get document with path and uid
    const doc = await admin.firestore().doc(path).get();
    if (doc.exists) {
      exportedDocs.push('FIRESTORE');
      exportedDocs.push(pathWithUid);
      exportedDocs.push(JSON.stringify(doc.data()));
    }
  }
  let csv = exportedDocs.join(',');

  archive.append(csv, { name: exportId + '.zip' });

  return { exportId }
});
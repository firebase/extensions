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
import * as firebase_tools from "firebase-tools";
import * as grpc from "grpc";

import config from "./config";
import * as logs from "./logs";

// Initialize the Firebase Admin SDK
admin.initializeApp();

// Workaround for cold start issue (https://github.com/firebase/extensions/issues/48).
// Remove this line when INTERNAL BUG 138705198 is resolved.
admin.firestore().settings({ grpc });

logs.init();

/*
 * The clearData function removes personal data from the RealTime Database,
 * Storage, and Firestore. It waits for all deletions to complete, and then
 * returns a success message.
 */
export const clearData = functions.auth.user().onDelete(async (user) => {
  logs.start();

  const { firestorePaths, rtdbPaths, storagePaths } = config;
  const { uid } = user;

  const promises = [];
  if (firestorePaths) {
    promises.push(clearFirestoreData(firestorePaths, uid));
  } else {
    logs.firestoreNotConfigured();
  }
  if (rtdbPaths) {
    promises.push(clearDatabaseData(rtdbPaths, uid));
  } else {
    logs.rtdbNotConfigured();
  }
  if (storagePaths) {
    promises.push(clearStorageData(storagePaths, uid));
  } else {
    logs.storageNotConfigured();
  }

  await Promise.all(promises);

  logs.complete(uid);
});

const clearDatabaseData = async (databasePaths: string, uid: string) => {
  logs.rtdbDeleting();

  const paths = extractUserPaths(databasePaths, uid);
  const promises = paths.map(async (path) => {
    try {
      logs.rtdbPathDeleting(path);
      await admin
        .database()
        .ref(path)
        .remove();
      logs.rtdbPathDeleted(path);
    } catch (err) {
      logs.rtdbPathError(path, err);
    }
  });

  await Promise.all(promises);

  logs.rtdbDeleted();
};

const clearStorageData = async (storagePaths: string, uid: string) => {
  logs.storageDeleting();

  const paths = extractUserPaths(storagePaths, uid);
  const promises = paths.map(async (path) => {
    const parts = path.split("/");
    const bucketName = parts[0];
    const bucket =
      bucketName === "{DEFAULT}"
        ? admin.storage().bucket()
        : admin.storage().bucket(bucketName);
    const file = bucket.file(parts.slice(1).join("/"));
    const bucketFilePath = `${bucket.name}/${file.name}`;
    try {
      logs.storagePathDeleting(bucketFilePath);
      await file.delete();
      logs.storagePathDeleted(bucketFilePath);
    } catch (err) {
      if (err.code === 404) {
        logs.storagePath404(bucketFilePath);
      } else {
        logs.storagePathError(bucketFilePath, err);
      }
    }
  });

  await Promise.all(promises);

  logs.storageDeleted();
};

const clearFirestoreData = async (firestorePaths: string, uid: string) => {
  logs.firestoreDeleting();

  const paths = extractUserPaths(firestorePaths, uid);
  const promises = paths.map(async (path) => {
    try {
      const isRecursive = config.firestoreDeleteMode === 'recursive';

      if (!isRecursive) {
        logs.firestorePathDeleting(path, false);
        await admin
          .firestore()
          .doc(path)
          .delete();
        logs.firestorePathDeleted(path, false);
      } else {
        logs.firestorePathDeleting(path, true);
        await firebase_tools.firestore.delete(path, {
          project: process.env.PROJECT_ID,
          recursive: true,
          yes: true, // auto-confirmation
        });
        logs.firestorePathDeleted(path, true);
      }
    } catch (err) {
      logs.firestorePathError(path, err);
    }
  });

  await Promise.all(promises);

  logs.firestoreDeleted();
};

const extractUserPaths = (paths: string, uid: string) => {
  return paths.split(",").map((path) => replaceUID(path, uid));
};

const replaceUID = (path: string, uid: string) => {
  return path.replace(/{UID}/g, uid);
};

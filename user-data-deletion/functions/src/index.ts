/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import config from "./config";
import * as logs from "./logs";

// Initialize the Firebase Admin SDK
admin.initializeApp();

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
    const file = bucket.file(parts[1]);
    try {
      logs.storagePathDeleting(path);
      await file.delete();
      logs.storagePathDeleted(path);
    } catch (err) {
      logs.storagePathError(path, err);
    }
  });

  await Promise.all(promises);

  logs.storageDeleted();
};

const clearFirestoreData = async (firestorePaths: string, uid: string) => {
  // admin.firestore().settings({
  //   timestampsInSnapshots: true,
  // });
  logs.firestoreDeleting();

  const paths = extractUserPaths(firestorePaths, uid);
  const promises = paths.map(async (path) => {
    try {
      logs.firestorePathDeleting(path);
      await admin
        .firestore()
        .doc(path)
        .delete();
      logs.firestorePathDeleted(path);
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

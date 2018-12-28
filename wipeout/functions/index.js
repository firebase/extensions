/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const _ = require("lodash");
const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();
let db;
let firestore;
let storage;

/*
 * The clearData function removes personal data from the RealTime Database,
 * Storage, and Firestore. It waits for all deletions to complete, and then
 * returns a success message.
 */
exports.clearData = functions.auth.user().onDelete((user) => {
  const uid = user.uid;

  const promises = [];
  if (process.env.FIRESTORE_PATHS) {
    console.log("Initializing Firestore");
    firestore = admin.firestore();
    firestore.settings({
      timestampsInSnapshots: true,
    });
    promises.push(clearFirestoreData(uid));
  }
  if (process.env.RTDB_PATHS) {
    console.log("Initializing RTDB");
    db = admin.database();
    promises.push(clearDatabaseData(uid));
  }
  if (process.env.STORAGE_PATHS) {
    storage = admin.storage();
    promises.push(clearStorageData(uid));
  }
  return Promise.all(promises).then(() =>
    console.log(`Successfully removed data for user #${uid}.`)
  );
});

const clearDatabaseData = (uid) => {
  const paths = process.env.RTDB_PATHS;

  const promises = _.map(paths.split(","), (path) => {
    path = replaceUID(path, uid);
    return db
      .ref(path)
      .remove()
      .catch((error) => {
        // Avoid execution interuption.
        console.error("Error deleting data at path: ", path, error);
      });
  });

  return Promise.all(promises).then(() => uid);
};

const clearStorageData = (uid) => {
  const paths = process.env.STORAGE_PATHS;

  const promises = _.map(paths.split(","), (path) => {
    path = replaceUID(path, uid);
    const parts = path.split("/");
    const bucketName = parts[0];
    let bucket;
    if (bucketName === "{DEFAULT}") {
      bucket = storage.bucket();
    } else {
      bucket = storage.bucket(bucketName);
    }
    const file = bucket.file(parts[1]);
    return file.delete().catch((error) => {
      console.error("Error deleting file: ", path, error);
    });
  });
  return Promise.all(promises).then(() => uid);
};

const clearFirestoreData = (uid) => {
  const paths = process.env.FIRESTORE_PATHS;

  const promises = _.map(paths.split(","), (path) => {
    path = replaceUID(path, uid);
    return firestore
      .doc(path)
      .delete()
      .catch((error) => {
        console.error("Error deleting document: ", path, error);
      });
  });
  return Promise.all(promises).then(() => uid);
};

const replaceUID = (str, uid) => {
  return str.replace(/{UID}/g, uid);
};

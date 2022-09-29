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
import { getDatabaseUrl } from "./helpers";

import config from "./config";
import * as logs from "./logs";
import { search } from "./search";
import { runCustomSearchFunction } from "./runCustomSearchFunction";
import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";

var _ = require("lodash");

// Helper function for selecting correct domain adrress
const databaseURL = getDatabaseUrl(
  config.selectedDatabaseInstance,
  config.selectedDatabaseLocation
);

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL,
});

const db = admin.firestore();

logs.init();

export const handleDeletion = functions.pubsub
  .topic(config.deletionTopic)
  .onPublish(async (message, context) => {
    const { paths } = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8")
    );

    if (!paths) return Promise.resolve();

    const batchArray = [];

    _.chunk(paths, 450).forEach((chunk, index) => {
      batchArray.push(db.batch());

      /** Loop through each path query */
      for (const path of chunk) {
        const docRef = db.doc(path);
        batchArray[index].delete(docRef);
      }
    });

    batchArray.forEach(async (batch) => await batch.commit());
  });

export const handleSearch = functions.pubsub
  .topic(config.searchTopic)
  .onPublish(async (message, context) => {
    const { path, uid } = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8")
    );

    /** Check if a document path */
    if (path.split("/").length % 2 === 0) {
      /** Delete document */
      const doc = db.doc(path);

      if (path.includes(uid)) {
        const toDelete = await doc.get();
        await toDelete.ref.delete();
      }

      return Promise.resolve();
    }

    /** Check for subcollections and documents */
    const collection = db.collection(path.toString());

    /** Delete collection if userId is included in the path */
    if (path.includes(uid)) {
      const snapshot = await collection.get();

      if (snapshot.docs.length) {
        const docs = snapshot.docs.map((doc) => doc.ref.path);
        await runBatchPubSubDeletions(docs);
      }
    }

    /** Seatch document Ids*/
    const snapshot = await collection
      .where(admin.firestore.FieldPath.documentId(), "==", uid)
      .get();

    if (snapshot.docs.length) {
      await runBatchPubSubDeletions(snapshot.docs.map((doc) => doc.ref.path));
    }

    /** Iterate through documents */
    if (config.searchFields) {
      for await (const field of config.searchFields.split(",")) {
        const snapshot = await collection.where(field, "==", uid).get();

        if (snapshot.docs.length) {
          const docs = snapshot.docs.map((doc) => doc.ref.path);
          await runBatchPubSubDeletions(docs);
        }
      }
    }

    return Promise.resolve();
  });

/*
 * The clearData function removes personal data from the RealTime Database,
 * Storage, and Firestore. It waits for all deletions to complete, and then
 * returns a success message.
 */
export const clearData = functions.auth.user().onDelete(async (user) => {
  logs.start();

  const {
    firestorePaths,
    rtdbPaths,
    storagePaths,
    queryCollection,
    enableSearch,
    searchFunction,
  } = config;
  const { uid } = user;

  const promises = [];
  if (firestorePaths) {
    promises.push(clearFirestoreData(firestorePaths, uid));
  } else {
    logs.firestoreNotConfigured();
  }
  if (rtdbPaths && databaseURL) {
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

  /** If search mode enable, run pubsub search fn */
  if (enableSearch) {
    await search(uid);
  }

  /** If search function provided, return a list of queries */
  if (config.searchFunction && config.searchFunction !== "") {
    await runCustomSearchFunction(uid);
  }

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
        ? admin.storage().bucket(config.storageBucketDefault)
        : admin.storage().bucket(bucketName);
    const prefix = parts.slice(1).join("/");
    try {
      logs.storagePathDeleting(prefix);
      await bucket.deleteFiles({
        prefix,
      });
      logs.storagePathDeleted(prefix);
    } catch (err) {
      if (err.code === 404) {
        logs.storagePath404(prefix);
      } else {
        logs.storagePathError(prefix, err);
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
      const isRecursive = config.firestoreDeleteMode === "recursive";

      if (!isRecursive) {
        const firestore = admin.firestore();
        logs.firestorePathDeleting(path, false);

        // Wrapping in transaction to allow for automatic retries (#48)
        await firestore.runTransaction((transaction) => {
          transaction.delete(firestore.doc(path));
          return Promise.resolve();
        });
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

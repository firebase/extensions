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
import { FieldPath, DocumentReference } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { getDatabaseUrl, hasValidUserPath } from "./helpers";
import chunk from "lodash.chunk";
import { getEventarc } from "firebase-admin/eventarc";

import config from "./config";
import * as logs from "./logs";
import { search } from "./search";
import { runCustomSearchFunction } from "./runCustomSearchFunction";
import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";
import { recursiveDelete } from "./recursiveDelete";

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

/** Setup EventArc Channels */
const eventChannel =
  process.env.EVENTARC_CHANNEL &&
  getEventarc().channel(process.env.EVENTARC_CHANNEL, {
    allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
  });

logs.init();

export const handleDeletion = functions.pubsub
  .topic(config.deletionTopic)
  .onPublish(async (message) => {
    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8")
    );

    const paths = data.paths as string[];
    const uid = data.uid as string;

    const batchArray = [];
    let invalidPaths = [];

    /** Get all chunks to process */
    const chunks = chunk<string>(paths, 450);

    /** Loop through each chunk */
    for (const chunk of chunks) {
      const batch = db.batch();

      /** Loop through each path query */
      for (const path of chunk) {
        const docRef = db.doc(path);

        const isValidPath = await hasValidUserPath(docRef, path, uid);

        if (!isValidPath) {
          invalidPaths.push(path);
          continue;
        }
        if (config.firestoreDeleteMode === "recursive") {
          await recursiveDelete(path);
        } else {
          batch.delete(docRef);
        }
      }

      batchArray.push(batch);
    }

    await Promise.all(batchArray.map((batch) => batch.commit()));

    if (invalidPaths.length > 0) {
      logs.warnInvalidPaths(invalidPaths.length, uid);
    }

    if (eventChannel) {
      await eventChannel.publish({
        type: `firebase.extensions.delete-user-data.v1.firestore`,
        data: {
          uid,
          documentPaths: paths,
          invalidPaths,
        },
      });
    }
  });

export const handleSearch = functions.pubsub
  .topic(config.discoveryTopic)
  .onPublish(async (message) => {
    const data = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8")
    );

    const path = data.path as string;
    const depth = data.depth as number;
    const nextDepth = (data.depth as number) + 1;
    const uid = data.uid as string;

    // Create a collection reference from the path
    const collection = db.collection(path);

    if (depth <= config.searchDepth) {
      // If the collection ID is the same as the UID, delete the entire collection and sub-collections
      if (collection.id === uid) {
        await recursiveDelete(path);

        if (eventChannel) {
          /** Publish event to EventArc */
          await eventChannel.publish({
            type: `firebase.extensions.delete-user-data.v1.firestore`,
            data: {
              uid,
              collectionPath: collection.path,
            },
          });
        }

        return;
      }

      const documentReferences = await collection.listDocuments();
      const documentReferencesToSearch: DocumentReference[] = [];
      const pathsToDelete: string[] = [];

      await Promise.all(
        documentReferences.map(async (reference) => {
          // Start a sub-collection search on each document.
          if (nextDepth <= config.searchDepth) {
            await search(uid, nextDepth, reference);
          }

          // If the ID of the document is the same as the UID, add it to delete list.
          if (reference.id === uid) {
            pathsToDelete.push(reference.path);
          }
          // If the user has search fields, add the document to the list of documents to search.
          else if (config.searchFields) {
            documentReferencesToSearch.push(reference);
          }
        })
      );

      // Get any documents which need searching, and then check their fields.
      if (documentReferencesToSearch.length > 0) {
        const snapshots = await db.getAll(...documentReferencesToSearch);

        for (const snapshot of snapshots) {
          if (snapshot.exists) {
            for (const field of config.searchFields.split(",")) {
              if (snapshot.get(new FieldPath(field)) === uid) {
                pathsToDelete.push(snapshot.ref.path);
                continue;
              }
            }
          }
        }
      }

      await runBatchPubSubDeletions(
        {
          firestorePaths: pathsToDelete,
        },
        uid
      );
    }
  });

/*
 * The clearData function removes personal data from the RealTime Database,
 * Storage, and Firestore. It waits for all deletions to complete, and then
 * returns a success message.
 */
export const clearData = functions.auth.user().onDelete(async (user) => {
  logs.start();

  const { firestorePaths, rtdbPaths, storagePaths, enableSearch } = config;

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
    await search(uid, 1);
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
      await admin.database().ref(path).remove();
      logs.rtdbPathDeleted(path);
    } catch (err) {
      logs.rtdbPathError(path, err);
    }
  });

  await Promise.all(promises);

  if (eventChannel) {
    /** Send database deletion event */
    await eventChannel.publish({
      type: `firebase.extensions.delete-user-data.v1.database`,
      data: {
        uid,
        paths,
      },
    });
  }

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

  if (eventChannel) {
    /** Send storage deletion event */
    await eventChannel.publish({
      type: `firebase.extensions.delete-user-data.v1.storage`,
      data: {
        uid,
        paths,
      },
    });
  }

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

        await recursiveDelete(path);

        logs.firestorePathDeleted(path, true);
      }
    } catch (err) {
      logs.firestorePathError(path, err);
    }
  });

  await Promise.all(promises);

  if (eventChannel) {
    /** Send firestore deletion event */
    await eventChannel.publish({
      type: `firebase.extensions.delete-user-data.v1.firestore`,
      data: {
        uid,
        documentPaths: paths,
      },
    });
  }

  logs.firestoreDeleted();
};

const extractUserPaths = (paths: string, uid: string) => {
  return paths.split(",").map((path) => replaceUID(path, uid));
};

const replaceUID = (path: string, uid: string) => {
  return path.replace(/{UID}/g, uid);
};

/**
 * Copyright 2026 Google LLC
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

import type * as admin from "firebase-admin";
import type { DocumentReference } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import chunk from "lodash.chunk";
import * as events from "./events";
import { extractUserPaths, hasValidUserPath } from "./helpers";
import * as logs from "./logs";
import { recursiveDelete } from "./recursiveDelete";
import {
  type PublisherContext,
  runBatchPubSubDeletions,
} from "./runBatchPubSubDeletions";
import { runCustomSearchFunction } from "./runCustomSearchFunction";
import { search } from "./search";

export interface HandlerContext extends PublisherContext {
  firestore: admin.firestore.Firestore;
  storage: admin.storage.Storage;
  database: admin.database.Database;
}

export interface DeleteMessageData {
  paths: string[];
  uid: string;
}

export interface SearchMessageData {
  path: string;
  depth: number;
  uid: string;
}

export async function handleDeletion(
  data: DeleteMessageData,
  ctx: HandlerContext
): Promise<void> {
  const { paths, uid } = data;
  const batchArray: admin.firestore.WriteBatch[] = [];
  const invalidPaths: string[] = [];

  for (const chunkedPaths of chunk<string>(paths, 450)) {
    const batch = ctx.firestore.batch();
    for (const path of chunkedPaths) {
      const docRef = ctx.firestore.doc(path);
      const isValidPath = await hasValidUserPath(
        docRef,
        path,
        uid,
        ctx.config.searchFields
      );

      if (!isValidPath) {
        invalidPaths.push(path);
        continue;
      }
      if (ctx.config.firestoreDeleteMode === "recursive") {
        await recursiveDelete(path, ctx.firestore);
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

  await events.publishDeletionEvent("firestore", {
    uid,
    documentPaths: paths,
    invalidPaths,
  });
}

export async function handleSearch(
  data: SearchMessageData,
  ctx: HandlerContext
): Promise<void> {
  const { path, depth, uid } = data;
  const nextDepth = depth + 1;
  const collection = ctx.firestore.collection(path);

  if (depth > ctx.config.searchDepth) return;

  if (collection.id === uid) {
    await recursiveDelete(path, ctx.firestore);
    await events.publishDeletionEvent("firestore", {
      uid,
      collectionPath: collection.path,
    });
    return;
  }

  const documentReferences = await collection.listDocuments();
  const documentReferencesToSearch: DocumentReference[] = [];
  const pathsToDelete: string[] = [];

  await Promise.all(
    documentReferences.map(async (reference) => {
      if (nextDepth <= ctx.config.searchDepth) {
        await search(uid, nextDepth, ctx.firestore, ctx, reference);
      }

      if (reference.id === uid) {
        pathsToDelete.push(reference.path);
      } else if (ctx.config.searchFields) {
        documentReferencesToSearch.push(reference);
      }
    })
  );

  if (documentReferencesToSearch.length > 0) {
    const snapshots = await ctx.firestore.getAll(...documentReferencesToSearch);
    for (const snapshot of snapshots) {
      if (snapshot.exists) {
        for (const field of ctx.config.searchFields.split(",")) {
          if (snapshot.get(new FieldPath(field)) === uid) {
            pathsToDelete.push(snapshot.ref.path);
          }
        }
      }
    }
  }

  await runBatchPubSubDeletions({ firestorePaths: pathsToDelete }, uid, ctx);
}

export async function handleClear(
  uid: string,
  ctx: HandlerContext
): Promise<void> {
  logs.start(ctx.config);

  const promises: Promise<void>[] = [];
  if (ctx.config.firestorePaths) {
    promises.push(clearFirestoreData(ctx.config.firestorePaths, uid, ctx));
  } else {
    logs.firestoreNotConfigured();
  }
  if (ctx.config.rtdbPaths) {
    promises.push(clearDatabaseData(ctx.config.rtdbPaths, uid, ctx));
  } else {
    logs.rtdbNotConfigured();
  }
  if (ctx.config.storagePaths) {
    promises.push(clearStorageData(ctx.config.storagePaths, uid, ctx));
  } else {
    logs.storageNotConfigured();
  }

  await Promise.all(promises);

  if (ctx.config.enableAutoDiscovery) {
    await search(uid, 1, ctx.firestore, ctx);
  }

  if (ctx.config.searchFunction) {
    await runCustomSearchFunction(uid, ctx);
  }

  logs.complete(uid);
}

async function clearDatabaseData(
  databasePaths: string,
  uid: string,
  ctx: HandlerContext
): Promise<void> {
  logs.rtdbDeleting();
  const paths = extractUserPaths(databasePaths, uid);
  await Promise.all(
    paths.map(async (path) => {
      try {
        logs.rtdbPathDeleting(path);
        await ctx.database.ref(path).remove();
        logs.rtdbPathDeleted(path);
      } catch (err) {
        logs.rtdbPathError(path, err as Error);
      }
    })
  );
  await events.publishDeletionEvent("database", { uid, paths });
  logs.rtdbDeleted();
}

async function clearStorageData(
  storagePaths: string,
  uid: string,
  ctx: HandlerContext
): Promise<void> {
  logs.storageDeleting();
  const paths = extractUserPaths(storagePaths, uid);
  await Promise.all(
    paths.map(async (path) => {
      const parts = path.split("/");
      const bucketName = parts[0];
      const bucket =
        bucketName === "{DEFAULT}"
          ? ctx.storage.bucket(ctx.config.storageBucket)
          : ctx.storage.bucket(bucketName);
      const prefix = parts.slice(1).join("/");
      try {
        logs.storagePathDeleting(prefix);
        await bucket.deleteFiles({ prefix });
        logs.storagePathDeleted(prefix);
      } catch (err) {
        if ((err as { code?: number }).code === 404) {
          logs.storagePath404(prefix);
        } else {
          logs.storagePathError(prefix, err as Error);
        }
      }
    })
  );
  await events.publishDeletionEvent("storage", { uid, paths });
  logs.storageDeleted();
}

async function clearFirestoreData(
  firestorePaths: string,
  uid: string,
  ctx: HandlerContext
): Promise<void> {
  logs.firestoreDeleting();
  const paths = extractUserPaths(firestorePaths, uid);
  await Promise.all(
    paths.map(async (path) => {
      try {
        const isRecursive = ctx.config.firestoreDeleteMode === "recursive";
        if (!isRecursive) {
          logs.firestorePathDeleting(path, false);
          await ctx.firestore.runTransaction((transaction) => {
            transaction.delete(ctx.firestore.doc(path));
            return Promise.resolve();
          });
          logs.firestorePathDeleted(path, false);
        } else {
          logs.firestorePathDeleting(path, true);
          await recursiveDelete(path, ctx.firestore);
          logs.firestorePathDeleted(path, true);
        }
      } catch (err) {
        logs.firestorePathError(path, err as Error);
      }
    })
  );
  await events.publishDeletionEvent("firestore", {
    uid,
    documentPaths: paths,
  });
  logs.firestoreDeleted();
}

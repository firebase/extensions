/*
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
import { type Firestore, Timestamp } from "firebase-admin/firestore";

/**
 * Creates a new transcript document in `PROCESSING` state and returns its id.
 *
 * When `collectionPath` is unset, Firestore output is disabled and an empty id
 * is returned.
 *
 * @param db - The Firestore instance to write through.
 * @param collectionPath - The target collection, or undefined to skip Firestore.
 * @param fileName - The name of the Storage object being transcribed.
 * @returns The created document id, or `""` when Firestore is disabled.
 */
export async function getFirestoreDocument(
  db: Firestore,
  collectionPath: string | undefined,
  fileName: string
): Promise<string> {
  if (!collectionPath) return "";

  const doc = await db.collection(collectionPath).add({
    status: "PROCESSING",
    fileName,
    created: Timestamp.now(),
  });

  return doc.id;
}

/**
 * Merges an update into an existing transcript document.
 *
 * No-op when `collectionPath` is unset (Firestore output disabled).
 *
 * @param db - The Firestore instance to write through.
 * @param collectionPath - The target collection, or undefined to skip Firestore.
 * @param documentId - The id of the document to update.
 * @param data - The partial document data to merge.
 */
export async function updateFirestoreDocument(
  db: Firestore,
  collectionPath: string | undefined,
  documentId: string,
  data: any
): Promise<void> {
  if (!collectionPath) return;

  const collection = db.collection(collectionPath);
  const document = collection.doc(documentId);

  await document.set({ ...data }, { merge: true });
}

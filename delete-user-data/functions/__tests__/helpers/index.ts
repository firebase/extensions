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

import * as admin from "firebase-admin";
import { UserRecord } from "firebase-functions/v1/auth";
import { Query, DocumentData } from "@google-cloud/firestore";

export const createFirebaseUser = async (): Promise<UserRecord> => {
  const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
  return admin.auth().createUser({ email });
};

export const clearCollection = async (
  collection: admin.firestore.CollectionReference
) => {
  const docs = await collection.listDocuments();

  for await (const doc of docs || []) {
    await doc.delete();
  }
};

export const waitForCollectionDeletion = (
  query: Query,
  timeout: number = 10_000
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Timeout waiting for collection deletion"));
    }, timeout);
    const unsubscribe = query.onSnapshot(async (snapshot) => {
      const hasDocuments = snapshot.docs.length;

      if (!hasDocuments) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(true);
        }
      }
    });
  });
};

export const waitForDocumentDeletion = (
  document: DocumentData,
  timeout: number = 10_000
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Timeout waiting for document deletion"));
    }, timeout);
    const unsubscribe = document.onSnapshot(async (doc) => {
      if (!doc.exists) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(true);
        }
      }
    });
  });
};

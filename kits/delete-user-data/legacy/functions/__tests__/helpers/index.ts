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

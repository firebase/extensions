import * as admin from "firebase-admin";
import config from "./config";

import { Timestamp } from "firebase-admin/firestore";

export async function updateFirestoreDocument(documentId: string, data: any) {
  if (!config.collectionPath) return;

  /** Get the Firestore document */
  const db = admin.firestore();
  const collection = db.collection(config.collectionPath);
  const document = collection.doc(documentId);

  await document.set({ ...data }, { merge: true });
}

export async function getFirestoreDocument(fileName: string): Promise<string> {
  if (!config.collectionPath) return "";

  const db = admin.firestore();

  const doc = await db.collection(config.collectionPath).add({
    status: "PROCESSING",
    fileName,
    created: Timestamp.now(),
  });

  return doc.id;
}

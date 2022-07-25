import * as admin from "firebase-admin";
import { Query, DocumentData } from "@google-cloud/firestore";
import { UserRecord } from "firebase-functions/v1/auth";

export const getDatabaseUrl = (
  selectedDatabaseInstance: string | undefined,
  selectedDatabaseLocation: string | undefined
) => {
  if (!selectedDatabaseLocation || !selectedDatabaseInstance) return null;

  if (selectedDatabaseLocation === "us-central1")
    return `https://${selectedDatabaseInstance}.firebaseio.com`;

  return `https://${selectedDatabaseInstance}.${selectedDatabaseLocation}.firebasedatabase.app`;
};

export async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

export async function repeat(
  fn: { (): Promise<any>; (): any },
  until: { ($: any): any; (arg0: any): any },
  retriesLeft = 5,
  interval = 1000
) {
  const result = await fn();

  if (!until(result)) {
    if (retriesLeft) {
      await new Promise((r) => setTimeout(r, interval));
      return repeat(fn, until, retriesLeft - 1, interval);
    }
    throw new Error("Max repeats count reached");
  }

  return result;
}

export const waitForDocumentToExistWithField = (
  document: DocumentData,
  field: string | number,
  timeout: number = 10_000
): Promise<DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Timeout waiting for firestore document"));
    }, timeout);
    const unsubscribe = document.onSnapshot(async (snapshot: DocumentData) => {
      if (snapshot.exists && snapshot.data()[field]) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(snapshot);
        }
      }
    });
  });
};

export const waitForDocumentUpdate = (
  document: DocumentData,
  field: string | number,
  value: any,
  timeout: number = 10_000
): Promise<FirebaseFirestore.DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Timeout waiting for firestore document"));
    }, timeout);
    const unsubscribe = document.onSnapshot(async (snapshot: DocumentData) => {
      if (snapshot.exists && snapshot.data()[field] === value) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(snapshot);
        }
      }
    });
  });
};

export const waitForDocumentToExistInCollection = (
  query: Query,
  field: string | number,
  value: any,
  timeout: number = 10_000
): Promise<DocumentData> => {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("Timeout waiting for firestore document"));
    }, timeout);
    const unsubscribe = query.onSnapshot(async (snapshot) => {
      const docs = snapshot.docChanges();

      const record: DocumentData = docs.filter(
        ($) => $.doc.data()[field] === value
      )[0];

      if (record) {
        unsubscribe();
        if (!timedOut) {
          clearTimeout(timer);
          resolve(record);
        }
      }
    });
  });
};

export const createFirebaseUser = async (): Promise<UserRecord> => {
  const email = `${Math.random()
    .toString(36)
    .substr(2, 5)}@google.com`;
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
      reject(new Error("Timeout waiting for firestore document"));
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

import * as admin from "firebase-admin";

const MAX_RETRY_ATTEMPTS = 3;

export const recursiveDelete = async (ref: string) => {
  const db = admin.firestore();
  // Recursively delete a reference and log the references of failures.
  const bulkWriter = db.bulkWriter();

  bulkWriter.onWriteError((error) => {
    if (error.failedAttempts < MAX_RETRY_ATTEMPTS) {
      return true;
    } else {
      console.warn("Failed to delete document: ", error.documentRef.path);
      return false;
    }
  });

  const isDocument = ref.split("/").length % 2 === 0;

  const reference = isDocument ? db.doc(ref) : db.collection(ref);

  await db.recursiveDelete(reference, bulkWriter);
};

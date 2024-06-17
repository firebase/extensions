import * as admin from "firebase-admin";

const firestore = admin.firestore();

export const saveCompletionFlag = async () => {
  const docRef = firestore.doc(`_meta/backfill`);
  await docRef.set({ completed: true });
};

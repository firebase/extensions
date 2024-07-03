import * as admin from "firebase-admin";
const firestore = admin.firestore();

export const getLastDoc = async (
  lastDocPath: string | null
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> => {
  if (!lastDocPath) return null;
  const docSnapshot = await firestore.doc(lastDocPath).get();
  return docSnapshot.exists
    ? (docSnapshot as FirebaseFirestore.QueryDocumentSnapshot)
    : null;
};

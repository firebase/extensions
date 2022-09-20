import * as admin from "firebase-admin";
import { DocumentData, Query, WhereFilterOp } from "@google-cloud/firestore";
import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";

export const runCustomQueries = async (
  userId
): Promise<Query<DocumentData>[]> => {
  const db = admin.firestore();
  const promises = [];
  const documents = [];

  const docs = await admin
    .firestore()
    .collection("queries")
    .listDocuments();

  for await (const doc of docs) {
    const document = await doc.get();

    const data = (documents[doc.id] = document.data());

    const ref = db.collectionGroup(
      data.collection === "{uid}" ? `${userId}` : data.collection
    );

    for await (const condition of data.conditions || []) {
      if (condition && condition.where) {
        ref.where(
          condition.where[0] as string,
          condition.where[1] as WhereFilterOp,
          condition.where[2].replace("{uid}", userId) as string
        );
      }
    }

    const snapshot = await ref.get();

    if (snapshot.docs) {
      await runBatchPubSubDeletions(snapshot.docs.map((doc) => doc.ref.path));
    }
  }

  return promises;
};

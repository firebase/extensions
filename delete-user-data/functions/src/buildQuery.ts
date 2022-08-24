import { DocumentData, Query, WhereFilterOp } from "@google-cloud/firestore";
import * as admin from "firebase-admin";

export const buildQuery = async (userId): Promise<Query<DocumentData>[]> => {
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

    promises.push(
      new Promise((resolve) => {
        ref.get().then((querySnapshot) => {
          querySnapshot.forEach(async (doc) => {
            console.log(doc.id, " => ", doc.data());
            (await data.recusrive)
              ? db.recursiveDelete(doc.ref)
              : db.doc(doc.ref.path).delete();
          });
        });
        resolve(true);
      })
    );
  }

  return promises;
};

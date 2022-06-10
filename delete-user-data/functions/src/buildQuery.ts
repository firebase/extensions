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

    const ref = db.collectionGroup(data.collection === "{uid}" ? `${userId}` : data.collection);
    const condition = (data.conditions || [])[0];

    if (!condition || !condition.length) {
      promises.push(
        new Promise((resolve) => {
          ref.get().then((querySnapshot) => {
            querySnapshot.forEach(async (doc) => {
              console.log(doc.id, " => ", doc.data());
              await data.recusrive ? db.recursiveDelete(doc.ref): db.doc(doc.ref.path).delete();
            });
          });
          resolve(true);
        })
      );
    }
    

    if (condition?.where) {
      promises.push(
        new Promise((resolve) => {
          ref
            .where(
              condition.where[0] as string,
              condition.where[1] as WhereFilterOp,
              condition.where[2].replace("{uid}", userId) as string
            )
            .get()
            .then((querySnapshot) => {
              querySnapshot.forEach(async (doc) => {
                console.log(doc.id, " => ", doc.data());
                await data.recusrive ? db.recursiveDelete(doc.ref): db.doc(doc.ref.path).delete();        
              });
              resolve(true);
            });
        })
      );
    }
  }

  console.log("heres >>>", promises);

  const result = await Promise.all(promises);

  console.log("result >>>", result);

  return promises;
};

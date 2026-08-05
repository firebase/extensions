import type * as admin from "firebase-admin";
import {
  type PublisherContext,
  publishSearch,
} from "./runBatchPubSubDeletions";

export const search = async (
  uid: string,
  depth: number,
  db: admin.firestore.Firestore,
  ctx: PublisherContext,
  document?: admin.firestore.DocumentReference<admin.firestore.DocumentData>
): Promise<void> => {
  const collections = !document
    ? await db.listCollections()
    : await document.listCollections();

  for (const collection of collections) {
    await publishSearch(uid, depth, collection.path, ctx);
  }
};

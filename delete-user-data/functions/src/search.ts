import * as admin from "firebase-admin";
const { PubSub } = require("@google-cloud/pubsub");

export const search = async (
  uid,
  document?: admin.firestore.DocumentReference<
    admin.firestore.DocumentData
  > | null
) => {
  const db = admin.firestore();

  const pubsub = new PubSub({ projectId: "demo-test" });

  const topic = pubsub.topic("projects/demo-test/topics/deletions");

  const collections = !document
    ? await db.listCollections()
    : await document.listCollections();

  for (const collection of collections) {
    await topic.publish(
      Buffer.from(JSON.stringify({ path: collection.path, uid }))
    );
  }
};

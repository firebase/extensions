import * as admin from "firebase-admin";
import * as config from "./config";
const { PubSub } = require("@google-cloud/pubsub");

export const search = async (
  uid,
  document?: admin.firestore.DocumentReference<
    admin.firestore.DocumentData
  > | null
) => {
  const db = admin.firestore();

  const pubsub = new PubSub();

  const topic = pubsub.topic(
    `projects/${process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.PROJECT_ID}/topics/${config.default.searchTopic}`
  );

  const collections = !document
    ? await db.listCollections()
    : await document.listCollections();

  for (const collection of collections) {
    topic.publish(Buffer.from(JSON.stringify({ path: collection.path, uid })));
  }
};

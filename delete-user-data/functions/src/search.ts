import * as admin from "firebase-admin";
import * as config from "./config";
const { PubSub } = require("@google-cloud/pubsub");

export const search = async (
  uid: string,
  depth: number,
  document?: admin.firestore.DocumentReference<admin.firestore.DocumentData>
) => {
  const db = admin.firestore();

  const pubsub = new PubSub();

  const topic = pubsub.topic(
    `projects/${
      process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID
    }/topics/${config.default.discoveryTopic}`
  );

  const collections = !document
    ? await db.listCollections()
    : await document.listCollections();

  for (const collection of collections) {
    topic.publish(
      Buffer.from(JSON.stringify({ path: collection.path, uid, depth }))
    );
  }
};

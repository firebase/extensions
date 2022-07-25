import { CollectionReference } from "@google-cloud/firestore";
import * as admin from "firebase-admin";
const { PubSub } = require("@google-cloud/pubsub");

export const search = async (userId) => {
  const db = admin.firestore();

  const pubsub = new PubSub({ projectId: "demo-test" });

  const topic = pubsub.topic("projects/demo-test/topics/deletions");

  const collections = await db.listCollections();

  const collectionIds = collections.map((col) => {
    console.log(col.id);
    return { id: col.id, ref: col };
  });

  const promises = collections
    .filter(($) => $.id === userId)
    .map((collection) => {
      return topic.publish(
        Buffer.from(
          JSON.stringify({ path: collection.path, type: "collection" })
        )
      );
    });

  console.log("publishes >>>", promises);

  await Promise.all(promises);

  return collectionIds;
};

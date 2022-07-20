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

  await topic.publish(Buffer.from("Test message!"));

  // collections.forEach((collection) => {
  //   // if (collection.id === userId) {
  //   console.log("Publishing >>>", topic.name);

  //   // }
  // });

  return collectionIds;
};

export const searchDocuments = async (ref: CollectionReference) => {
  const db = admin.firestore();
};

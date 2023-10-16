import * as admin from "firebase-admin";
import { runBatchPubSubDeletions } from "../src/runBatchPubSubDeletions";
import setupEnvironment from "./helpers/setupEnvironment";

import { Paths } from "../src/types";

admin.initializeApp();
setupEnvironment();

const db = admin.firestore();

const generateTopLevelUserCollection = async (name) => {
  const collection = db.collection(name);

  return collection;
};

describe("runBatchPubSubDeletions", () => {
  let rootCollection: admin.firestore.CollectionReference;

  beforeEach(async () => {
    rootCollection = await generateTopLevelUserCollection(
      "runBatchPubSubDeletions"
    );
  });

  test("cannot delete paths with an invalid userId", async () => {
    /** Add a new document for testing */
    const doc = await rootCollection.add({ testing: "testing" });
    const invalidUserId = "invalidUserId";

    const paths: Paths = { firestorePaths: [`${rootCollection.id}/${doc.id}`] };

    /** Run deletion */
    await runBatchPubSubDeletions(paths, invalidUserId);

    /** Wait 10 seconds */
    await new Promise((resolve) => setTimeout(resolve, 10000));

    /** Check document still exist */
    const documentCheck = await doc.get();
    expect(documentCheck.exists).toBe(true);
  }, 60000);
});

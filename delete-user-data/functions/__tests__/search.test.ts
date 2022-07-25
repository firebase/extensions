import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { search } from "../src//search";
import { createFirebaseUser, waitForCollectionDeletion } from "../src/helpers";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

const environment = {
  queryCollection: "queries",
};

admin.initializeApp();
setupEnvironment();

const db = admin.firestore();
const auth = admin.auth();


const queryCollection = db.collection(environment.queryCollection);

const generateRandomEmail = () => {
  var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  var string = "";
  for (var ii = 0; ii < 15; ii++) {
    string += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${string}@google.com`;
};

const generateTopLevelUserCollection = async (userId) => {
  const collection = db.collection(userId);
  await collection.add({})
  return collection;
};

describe("search", () => {
  let user: UserRecord;
  let collection: admin.firestore.CollectionReference;
  beforeEach(async () => {
    user = await createFirebaseUser();
    collection = await  generateTopLevelUserCollection(user.uid);
  });

  describe("can delete a top level collection", () => {
    test("truthy", async () => {
      await search(user?.uid);

      await waitForCollectionDeletion(collection)
    });
  });
});

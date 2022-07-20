import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { search } from "../src//search";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

const environment = {
  queryCollection: "queries",
};

admin.initializeApp();
setupEnvironment();

const db = admin.firestore();
const auth = admin.auth();
let user: UserRecord;

const queryCollection = db.collection(environment.queryCollection);
// const usersCollection = db.collection("users");

const generateRandomEmail = () => {
  var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  var string = "";
  for (var ii = 0; ii < 15; ii++) {
    string += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${string}@google.com`;
};

const clearCollection = async (
  collection: admin.firestore.CollectionReference
) => {
  const docs = await collection.listDocuments();

  for await (const doc of docs || []) {
    await doc.delete();
  }
};

const generateNestedCollections = async () => {
  const doc1 = await queryCollection.doc("doc1").set({});

  const doc2 = queryCollection
    .doc("doc1")
    .collection("collection2")
    .doc("doc2")
    .set({});

  const doc3 = queryCollection
    .doc("doc1")
    .collection("collection2")
    .doc("doc2")
    .collection("collection3")
    .doc("doc3")
    .set({});
};

describe("buildQueries", () => {
  beforeEach(async () => {
    await generateNestedCollections();
    user = await auth.createUser({ email: generateRandomEmail() });
  });

  describe("using a single where clause", () => {
    test("truthy", async () => {
      const collections = await search(user?.uid);

      console.log(collections);
    });
  });
});

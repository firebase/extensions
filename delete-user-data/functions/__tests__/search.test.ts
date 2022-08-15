import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { search } from "../src//search";
import { createFirebaseUser, waitForCollectionDeletion, waitForDocumentDeletion } from "../src/helpers";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

const environment = {
  queryCollection: "queries",
};

admin.initializeApp();
setupEnvironment();

const db = admin.firestore();



const generateRandomId = () => {
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
  let rootCollection: admin.firestore.CollectionReference;
  beforeEach(async () => {
    user = await createFirebaseUser();
    rootCollection = await  generateTopLevelUserCollection(user.uid);
  });

  describe("top level collections", () => {
    test("can delete is single collection named {uid}", async () => {
      await search(user?.uid);

      await waitForCollectionDeletion(rootCollection)
    }, 60000);    
  });

  describe("top level collection documents", () => {
    test("can delete a document named {uid}", async () => {
      const document = await db.collection(generateRandomId()).doc(user?.uid);
      await search(user?.uid);

      await waitForDocumentDeletion(document);
    }, 60000);

    test("can delete a document with a field value named {uid}", async () => {
      const document = await db.collection(generateRandomId()).add({ test: user.uid});
      await search(user?.uid);

      await waitForDocumentDeletion(document);
    }, 60000);

    test("can check a document without any field values", async () => {
      await db.collection(generateRandomId()).add({});
      await search(user?.uid);

      expect(true).toBeTruthy();
    }, 60000);
  });

  describe("sub collection", () => {
    test("can delete a subcollection document named {uid}", async () => {
      const collection = await db.collection(generateRandomId()).doc().collection(user?.uid);
      await collection.add({});

      const checkExists = await (await collection.get()).docs[0].exists;

      expect(checkExists).toBe(true);

      await search(user?.uid);

      await waitForCollectionDeletion(collection);
    }, 60000);
  });
});

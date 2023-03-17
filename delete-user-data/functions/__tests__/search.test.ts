import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { search } from "../src/search";
import {
  createFirebaseUser,
  waitForCollectionDeletion,
  waitForDocumentDeletion,
} from "./helpers";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";
import config from "../src/config";

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
  await collection.add({});
  return collection;
};

describe("discovery", () => {
  let user: UserRecord;
  let rootCollection: admin.firestore.CollectionReference;
  beforeEach(async () => {
    user = await createFirebaseUser();
    rootCollection = await generateTopLevelUserCollection(user.uid);
  });

  describe("searches on top level collections", () => {
    test("can delete is single collection named {uid}", async () => {
      await search(user.uid, 1);

      await waitForCollectionDeletion(rootCollection, 20_000);
    }, 60000);
  });

  describe("searches on top level collection documents", () => {
    test("can delete a document named {uid}", async () => {
      const document = await db.collection(generateRandomId()).doc(user.uid);
      await search(user.uid, 1);

      await waitForDocumentDeletion(document);
    }, 60000);

    test("can delete a document with a field value named {uid}", async () => {
      const document = await db
        .collection(generateRandomId())
        .add({ field1: user.uid });
      await search(user.uid, 1);

      await waitForDocumentDeletion(document, 60000);
    }, 60000);

    test("can check a document without any field values", async () => {
      await db.collection(generateRandomId()).add({});
      await search(user.uid, 1);

      expect(true).toBeTruthy();
    }, 60000);
  });

  describe("sub collection", () => {
    test("can delete a subcollection named {uid}", async () => {
      const collection = await db.collection(
        "can-delete-a-subcollection-named-uid"
      );

      const subcollection = await collection
        .doc("subcollection")
        .collection(user.uid);

      await subcollection.add({ foo: "bar" });

      const checkExists = await subcollection
        .get()
        .then((col) => col.docs.length > 0);

      expect(checkExists).toBe(true);

      await search(user.uid, 1);

      await waitForCollectionDeletion(subcollection);
    }, 60000);
  });

  describe("does not exceed the search depth", () => {
    test("on a collection named {uid}", async () => {
      const subcollection = await db
        .collection("1")
        .doc("1")
        .collection("2")
        .doc("2")
        .collection("3")
        .doc("3")
        .collection("4")
        .doc("4")
        .collection(`${user.uid}`);

      await subcollection.add({ foo: "bar" });

      const collectionPathCount = subcollection.path.split("/").length / 2;

      expect(collectionPathCount).toBeGreaterThan(config.searchDepth);

      await search(user.uid, 1);

      // /** Wait 10 seconds for the discovery to complete */
      await new Promise((resolve) => setTimeout(resolve, 20000));

      // /** Check that document still exists */
      const checkExists = await subcollection.get().then((collection) => {
        return collection.docs.length > 0;
      });

      expect(checkExists).toBe(true);
    }, 60000);

    test("on a document with a field named {uid}", async () => {
      const subcollection = await db
        .collection("1")
        .doc("1")
        .collection("2")
        .doc("2")
        .collection("3")
        .doc("3")
        .collection("4")
        .doc("4")
        .collection("5");

      await subcollection.add({ field1: `${user.uid}` });

      const collectionPathCount = subcollection.path.split("/").length / 2;

      expect(collectionPathCount).toBeGreaterThan(config.searchDepth);

      await search(user.uid, 1);

      // /** Wait 10 seconds for the discovery to complete */
      await new Promise((resolve) => setTimeout(resolve, 20000));

      // /** Check that document still exists */
      const checkExists = await subcollection.get().then((collection) => {
        return collection.docs.length > 0;
      });

      expect(checkExists).toBe(true);
    }, 60000);
  });

  describe("does not delete documents that do not match the search criteria", () => {
    test("can delete a document named {uid}", async () => {
      /** Create a collection to try and delete */
      const collection = await db.collection(generateRandomId());
      const document = await collection.add({ testing: "should-not-delete" });

      await search(collection.id, -1, document);

      /** Check document still exists */
      const checkExists = await document.get().then((doc) => doc.exists);
      expect(checkExists).toBe(true);
    }, 60000);

    test("cannot delete a document without a valid field named {uid}", async () => {
      const document = await db
        .collection(generateRandomId())
        .add({ field1: "unknown" });
      await search(user.uid, 1);

      /** Wait 10 seconds */
      await new Promise((resolve) => setTimeout(resolve, 10000));

      /** Check document still exists */
      const checkExists = await document.get().then((doc) => doc.exists);
      expect(checkExists).toBe(true);
    }, 60000);
  });
});

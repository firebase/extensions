// Import your function and any necessary Firebase modules
import { recursiveDelete } from "../src/recursiveDelete"; // Update with your actual file path
import * as admin from "firebase-admin";

const bulkWriterMock = () => ({
  onWriteError: jest.fn(),
  close: jest.fn(() => Promise.resolve()),
});
// Mock admin and firestore

admin.initializeApp();

describe("recursiveDelete", () => {
  // Common setup
  const db = admin.firestore();

  test("successfully deletes a document reference", async () => {
    const ref = "documents/doc1";
    db.doc(ref).create({
      foo: "bar",
    });

    await recursiveDelete(ref);

    const doc = db.doc(ref);
    await doc.get().then((doc) => {
      expect(doc.exists).toBe(false);
    });
  });

  test("successfully deletes a collection reference", async () => {
    const ref = "documents/doc1/collection1";
    db.collection(ref).add({
      foo: "bar",
    });

    await recursiveDelete(ref);

    const collection = db.collection(ref);
    await collection.get().then((collection) => {
      expect(collection.docs.length).toBe(0);
    });
  });

  test("successfully deletes a document with a subcollection", async () => {
    const parentRef = "documents/doc1";
    const ref = "documents/doc1/collection1/doc2/collection2";
    db.collection(ref).add({
      foo: "bar",
    });

    await recursiveDelete(parentRef);

    const collection = db.collection(ref);
    await collection.get().then((collection) => {
      expect(collection.docs.length).toBe(0);
    });
  });
});

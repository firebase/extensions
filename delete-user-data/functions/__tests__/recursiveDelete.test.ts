/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

    await recursiveDelete(ref, db);

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

    await recursiveDelete(ref, db);

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

    await recursiveDelete(parentRef, db);

    const collection = db.collection(ref);
    await collection.get().then((collection) => {
      expect(collection.docs.length).toBe(0);
    });
  });
});

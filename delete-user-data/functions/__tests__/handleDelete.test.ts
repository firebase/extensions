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

import { handleDeletion } from "../src";
import * as admin from "firebase-admin"; // Import Firebase admin to mock Firestore
import firebaseFunctionsTest from "firebase-functions-test";
import { search } from "../src/search";
import { Message } from "@google-cloud/pubsub";

const testEnv = firebaseFunctionsTest();
const { wrap } = testEnv;

jest.mock("../src/config", () => ({
  location: "us-central1",
  firestorePaths: "test",
  firestoreDeleteMode: "recursive",
  rtdbPaths: undefined,
  storagePaths: undefined,
  enableSearch: true,
  storageBucketDefault: "test",
  selectedDatabaseInstance: "test",
  selectedDatabaseLocation: "us-central1",
  searchFields: "uid",
  searchFunction: undefined,
  discoveryTopic: "ext-test-discovery",
  deletionTopic: "ext-test-deletion",
  searchDepth: 3,
}));
const wrapped = wrap(handleDeletion);
const wrappedHandleDelete = ({
  uid,
  paths,
}: {
  uid: string;
  paths: string[];
}) => {
  //@ts-ignore
  return wrapped({
    data: Buffer.from(JSON.stringify({ uid, paths })).toString("base64"),
  });
};

const db = admin.firestore();

describe("handleDelete", () => {
  test("should delete valid paths correctly", async () => {
    const paths = ["valid/path1", "valid/path2"];

    for (const path of paths) {
      await db.doc(path).set({ uid: "testUid" });
    }
    await wrappedHandleDelete({ uid: "testUid", paths });

    const checkExists = await Promise.all(
      paths.map(async (path) => {
        const doc = await db.doc(path).get();
        return doc.exists;
      })
    );
    for (const exists of checkExists) {
      expect(exists).toBe(false);
    }
  });

  test("should delete subcollections of matching docs", async () => {
    const paths = ["valid/path1", "valid/path2"];

    for (const path of paths) {
      await db.doc(path).set({ uid: "testUid" });
      await db.doc(`${path}/subcollection/doc`).set({ foo: "bar" });
    }

    await wrappedHandleDelete({ uid: "testUid", paths });

    const checkExists = await Promise.all(
      paths.map(async (path) => {
        const doc = await db.doc(path).get();
        return doc.exists;
      })
    );

    for (const exists of checkExists) {
      expect(exists).toBe(false);
    }

    const subcollectionDocs = await Promise.all(
      paths.map(async (path) => {
        const snapshot = await db.doc(`${path}/subcollection/doc`).get();
        return snapshot.exists;
      })
    );

    for (const exists of subcollectionDocs) {
      expect(exists).toBe(false);
    }
  });
});

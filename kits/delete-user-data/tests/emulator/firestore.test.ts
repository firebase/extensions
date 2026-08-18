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

import type { Firestore } from "firebase-admin/firestore";
import { beforeAll, describe, expect, test } from "vitest";

import { hasValidUserPath } from "../../src/helpers";
import { recursiveDelete } from "../../src/recursiveDelete";
import { initialize, randomId } from "./helpers";

const SEARCH_FIELDS = "id,uid,userId";

let db: Firestore;

beforeAll(() => {
  ({ db } = initialize());
});

describe("recursiveDelete", () => {
  test("deletes a document reference", async () => {
    const ref = `${randomId()}/doc1`;
    await db.doc(ref).set({ foo: "bar" });

    await recursiveDelete(ref, db);

    expect((await db.doc(ref).get()).exists).toBe(false);
  });

  test("deletes a collection reference", async () => {
    const ref = `${randomId()}/doc1/collection1`;
    await db.collection(ref).add({ foo: "bar" });

    await recursiveDelete(ref, db);

    expect((await db.collection(ref).get()).docs).toHaveLength(0);
  });

  test("deletes a document together with its subcollections", async () => {
    const root = randomId();
    const parentRef = `${root}/doc1`;
    const nested = `${root}/doc1/collection1/doc2/collection2`;
    await db.doc(parentRef).set({ foo: "bar" });
    await db.collection(nested).add({ foo: "bar" });

    await recursiveDelete(parentRef, db);

    expect((await db.collection(nested).get()).docs).toHaveLength(0);
  });
});

describe("hasValidUserPath", () => {
  test("is true when a field holds the uid", async () => {
    const uid = randomId();
    const doc = await db.collection(randomId()).add({ uid });

    expect(await hasValidUserPath(doc, "", uid, SEARCH_FIELDS)).toBe(true);
  });

  test("is true when a field holds a path containing the uid", async () => {
    const uid = randomId();
    const doc = await db.collection(randomId()).add({ uid: `testing/${uid}` });

    expect(await hasValidUserPath(doc, "", uid, SEARCH_FIELDS)).toBe(true);
  });

  test("is false for a non-string field value", async () => {
    const doc = await db.collection(randomId()).add({ uid: 12345 });

    expect(await hasValidUserPath(doc, "", "234", SEARCH_FIELDS)).toBe(false);
  });
});

/*
 * Copyright 2022 Google LLC
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

import * as admin from "firebase-admin";
import { buildQuery } from "../src/build_bundle";

describe("buildQuery", () => {
  let db: admin.firestore.Firestore;
  beforeEach(() => {
    db = admin.initializeApp({ projectId: "demo-experimental" }).firestore();
  });

  it("should build expected queries", () => {
    const queries: [admin.firestore.Query, admin.firestore.Query][] = [
      [
        buildQuery(db, { collection: "test-coll", conditions: [] }, {}, {}),
        db.collection("test-coll") as admin.firestore.Query,
      ],
      [
        buildQuery(
          db,
          {
            collection: "test-coll",
            conditions: [],
            collectionGroupQuery: true,
          },
          {},
          {}
        ),
        db.collectionGroup("test-coll") as admin.firestore.Query,
      ],
      [
        buildQuery(
          db,
          {
            collection: "test-coll",
            conditions: [
              { offset: 199 },
              { limit: 10 },
              { where: ["field1", "!=", 123.9] },
              { orderBy: ["field1"] },
            ],
          },
          {},
          {}
        ),
        db
          .collection("test-coll")
          .where("field1", "!=", 123.9)
          .orderBy("field1")
          .limit(10)
          .offset(199),
      ],
      [
        buildQuery(
          db,
          {
            collection: "test-coll/doc-a/coll-ab",
            conditions: [
              { where: ["field1", "in", ["a", "d", "e"]] },
              { orderBy: ["field1", "desc"] },
              { startAt: "a" },
              { endBefore: "f" },
              { limitToLast: 10 },
            ],
          },
          {},
          {}
        ),
        db
          .collection("test-coll")
          .doc("doc-a")
          .collection("coll-ab")
          .where("field1", "in", ["a", "d", "e"])
          .orderBy("field1", "desc")
          .limitToLast(10)
          .startAt("a")
          .endBefore("f"),
      ],
      [
        buildQuery(
          db,
          {
            collection: "test-coll/doc-a/coll-ab",
            conditions: [
              { where: ["$field", "array-contains", "$contains"] },
              { orderBy: ["$field"] },
              { limitToLast: "$limit" },
            ],
          },
          {
            field: { type: "string", required: true },
            limit: { type: "integer" },
            contains: { type: "string-array" },
          },
          {
            field: "field1",
            limit: 10,
            contains: ["a", "d", "e"],
          }
        ),
        db
          .collection("test-coll")
          .doc("doc-a")
          .collection("coll-ab")
          .where("field1", "array-contains", ["a", "d", "e"])
          .orderBy("field1")
          .limitToLast(10),
      ],
      [
        buildQuery(
          db,
          {
            collection: "test-coll",
            conditions: [
              { where: ["$field", "!=", "$value"] },
              { where: ["$otherField", "==", "$floatValue"] },
              { orderBy: ["$field"] },
            ],
          },
          {
            field: { type: "string", required: true },
            otherField: { type: "string" },
            floatValue: { type: "float" },
            value: { type: "boolean" },
          },
          {
            field: "field1",
            otherField: "otherField",
            floatValue: 3.0,
            value: false,
          }
        ),
        db
          .collection("test-coll")
          .where("field1", "!=", false)
          .where("otherField", "==", 3.0)
          .orderBy("field1"),
      ],
    ];

    for (const [actual, expected] of queries) {
      // Comparing queries in serialized form, the built-in `isEqual` method compares
      // functions, and will mistakenly return false.
      expect(JSON.stringify(actual)).toEqual(JSON.stringify(expected));
    }
  });
});

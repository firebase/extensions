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

import { describe, expect, test, vi } from "vitest";
import { extractUserPaths, hasValidUserPath } from "../src/helpers";
import { createFakeFirestore } from "./fakes";

const UID = "test-uid";

// Parity: delete-user-data/functions/__tests__/helpers.test.ts
// ("hasValidUserPath"). The kit takes `searchFields` as an argument instead of
// reading module config, so each case passes it explicitly.
describe("hasValidUserPath", () => {
  test("returns true if the field matches the uid exactly", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { field1: UID },
    });

    await expect(
      hasValidUserPath(db.doc("hasValidUserPath/doc1"), "", UID, "field1")
    ).resolves.toBe(true);
  });

  test("returns true if the field contains the uid as a path", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { field1: `testing/${UID}` },
    });

    await expect(
      hasValidUserPath(db.doc("hasValidUserPath/doc1"), "", UID, "field1")
    ).resolves.toBe(true);
  });

  test("returns false for a non-string field value", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { field1: 1234 },
    });

    await expect(
      hasValidUserPath(db.doc("hasValidUserPath/doc1"), "", UID, "field1")
    ).resolves.toBe(false);
  });

  test("returns false when the document does not exist", async () => {
    const db = createFakeFirestore();

    await expect(
      hasValidUserPath(db.doc("hasValidUserPath/missing"), "", UID, "field1")
    ).resolves.toBe(false);
  });

  test("returns true from the path without reading the document", async () => {
    const db = createFakeFirestore();
    const ref = db.doc(`users/${UID}`);
    const get = vi.spyOn(ref, "get");

    await expect(
      hasValidUserPath(ref, `users/${UID}`, UID, "uid")
    ).resolves.toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  test("checks every configured search field", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { userId: UID },
    });

    await expect(
      hasValidUserPath(
        db.doc("hasValidUserPath/doc1"),
        "",
        UID,
        "id,uid,userId"
      )
    ).resolves.toBe(true);
  });

  test("tolerates a trailing comma in the search fields", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { uid: UID },
    });

    await expect(
      hasValidUserPath(db.doc("hasValidUserPath/doc1"), "", UID, "uid,")
    ).resolves.toBe(true);
  });

  // Kit-specific: the extension builds `new FieldPath("")` here and throws.
  test("short-circuits to false when no search fields are configured", async () => {
    const db = createFakeFirestore({
      "hasValidUserPath/doc1": { uid: UID },
    });
    const ref = db.doc("hasValidUserPath/doc1");
    const get = vi.spyOn(ref, "get");

    await expect(hasValidUserPath(ref, "", UID, "")).resolves.toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("extractUserPaths", () => {
  test("substitutes every {UID} placeholder", () => {
    expect(extractUserPaths("users/{UID}/posts/{UID}", UID)).toEqual([
      `users/${UID}/posts/${UID}`,
    ]);
  });

  test("splits comma separated paths", () => {
    expect(
      extractUserPaths("users/{UID},admins/{UID},static/path", UID)
    ).toEqual([`users/${UID}`, `admins/${UID}`, "static/path"]);
  });
});

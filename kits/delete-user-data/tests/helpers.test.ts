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

import type { DocumentReference } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";

import { extractUserPaths, hasValidUserPath } from "../src/helpers";

const SEARCH_FIELDS = "id,uid,userId";

/** Fake document reference exposing only the fields hasValidUserPath reads. */
function docRef(data: Record<string, unknown> | undefined): DocumentReference {
  return {
    get: async () => ({
      exists: data !== undefined,
      get: (fieldPath: unknown) => data?.[String(fieldPath)],
    }),
  } as unknown as DocumentReference;
}

describe("hasValidUserPath", () => {
  test("returns true if the path itself contains the uid", async () => {
    const ref = docRef(undefined);

    expect(await hasValidUserPath(ref, "users/uid1", "uid1", "")).toBe(true);
  });

  test("returns true if a search field holds the uid", async () => {
    const ref = docRef({ uid: "uid1" });

    expect(await hasValidUserPath(ref, "", "uid1", SEARCH_FIELDS)).toBe(true);
  });

  test("returns true if a search field holds a path containing the uid", async () => {
    const ref = docRef({ uid: "testing/uid1" });

    expect(await hasValidUserPath(ref, "", "uid1", SEARCH_FIELDS)).toBe(true);
  });

  test("returns false for a non-string field value", async () => {
    // The uid is a substring of the stringified number, so this only passes
    // while the field value is required to be a string.
    const ref = docRef({ uid: 12345 });

    expect(await hasValidUserPath(ref, "", "234", SEARCH_FIELDS)).toBe(false);
  });

  test("returns false if no search field matches", async () => {
    const ref = docRef({ uid: "someone-else" });

    expect(await hasValidUserPath(ref, "", "uid1", SEARCH_FIELDS)).toBe(false);
  });

  test("returns false if the document does not exist", async () => {
    const ref = docRef(undefined);

    expect(await hasValidUserPath(ref, "", "uid1", SEARCH_FIELDS)).toBe(false);
  });

  test("does not read the document when no search fields are configured", async () => {
    let read = false;
    const ref = {
      get: async () => {
        read = true;
        return { exists: true, get: () => "uid1" };
      },
    } as unknown as DocumentReference;

    expect(await hasValidUserPath(ref, "users/other", "uid1", "")).toBe(false);
    expect(read).toBe(false);
  });
});

describe("extractUserPaths", () => {
  test("substitutes every {UID} placeholder", () => {
    expect(extractUserPaths("users/{UID},logs/{UID}/entries", "uid1")).toEqual([
      "users/uid1",
      "logs/uid1/entries",
    ]);
  });

  test("leaves paths without a placeholder untouched", () => {
    expect(extractUserPaths("public/data", "uid1")).toEqual(["public/data"]);
  });
});

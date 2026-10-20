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

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

let assertValidParams: () => void;

beforeAll(async () => {
  process.env.FIREBASE_KIT_INSTANCE_ID ??= "test-instance";
  ({ assertValidParams } = await import("../src/config"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Values the published extension's install API rejects (checked with
// `validateOnly` against firebase/delete-user-data@0.1.30).
const REJECTED: Array<[string, string, string]> = [
  ["FIRESTORE_DELETE_MODE", "RECURSIVE", "recursive, shallow"],
  ["FIRESTORE_DELETE_MODE", "recursivex", "recursive, shallow"],
  ["FIRESTORE_DELETE_MODE", "recursive ", "recursive, shallow"],
  ["ENABLE_AUTO_DISCOVERY", "true", "yes, no"],
  ["ENABLE_AUTO_DISCOVERY", "YES", "yes, no"],
  [
    "SELECTED_DATABASE_LOCATION",
    "us-east1",
    "us-central1, europe-west1, asia-southeast1",
  ],
  [
    "SELECTED_DATABASE_LOCATION",
    "US-CENTRAL1",
    "us-central1, europe-west1, asia-southeast1",
  ],
  [
    "SELECTED_DATABASE_INSTANCE",
    "https://x.firebaseio.com",
    "Invalid database instance",
  ],
  ["CLOUD_STORAGE_BUCKET", "gs://x", "Invalid storage bucket"],
  ["CLOUD_STORAGE_BUCKET", "Upper_Case", "Invalid storage bucket"],
];

const ACCEPTED: Array<[string, string]> = [
  ["FIRESTORE_DELETE_MODE", "recursive"],
  ["FIRESTORE_DELETE_MODE", "shallow"],
  ["ENABLE_AUTO_DISCOVERY", "yes"],
  ["ENABLE_AUTO_DISCOVERY", "no"],
  ["SELECTED_DATABASE_LOCATION", "us-central1"],
  ["SELECTED_DATABASE_LOCATION", "europe-west1"],
  ["SELECTED_DATABASE_LOCATION", "asia-southeast1"],
  ["SELECTED_DATABASE_INSTANCE", "my-instance"],
  ["CLOUD_STORAGE_BUCKET", "my-project-12345.appspot.com"],
  ["CLOUD_STORAGE_BUCKET", "my_bucket-1.example"],
];

describe("assertValidParams", () => {
  test("passes when no params have been supplied yet", () => {
    expect(() => assertValidParams()).not.toThrow();
  });

  test.each(REJECTED)("rejects %s=%j", (name, value, allowed) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).toThrow(
      `${name}=${JSON.stringify(value)}`
    );
    expect(() => assertValidParams()).toThrow(allowed);
  });

  test.each(ACCEPTED)("accepts %s=%j", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).not.toThrow();
  });

  // The extension accepts a select label, stores it verbatim, and its runtime
  // then treats `Recursive` as shallow and `Yes` as off. Only values are safe.
  test.each([
    ["FIRESTORE_DELETE_MODE", "Recursive"],
    ["ENABLE_AUTO_DISCOVERY", "Yes"],
    ["SELECTED_DATABASE_LOCATION", "Belgium"],
  ])("rejects the option label %s=%j", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).toThrow(name);
  });

  // Blank values belong to assertRequiredParams; optional ones may be blank,
  // as in the extension.
  test.each([
    "FIRESTORE_DELETE_MODE",
    "ENABLE_AUTO_DISCOVERY",
    "SELECTED_DATABASE_LOCATION",
    "SELECTED_DATABASE_INSTANCE",
    "CLOUD_STORAGE_BUCKET",
  ])("leaves an empty %s alone", (name) => {
    vi.stubEnv(name, "");

    expect(() => assertValidParams()).not.toThrow();
  });

  test("names every invalid param in one error", () => {
    vi.stubEnv("FIRESTORE_DELETE_MODE", "RECURSIVE");
    vi.stubEnv("ENABLE_AUTO_DISCOVERY", "true");

    expect(() => assertValidParams()).toThrow(
      /FIRESTORE_DELETE_MODE="RECURSIVE".*; ENABLE_AUTO_DISCOVERY="true"/
    );
  });
});

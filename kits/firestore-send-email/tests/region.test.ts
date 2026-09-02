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

import { describe, expect, test } from "vitest";

import { firestoreLocationToFunctionRegion } from "../src/region";

describe("firestoreLocationToFunctionRegion", () => {
  test.each([
    ["nam5", "us-central1"],
    ["nam7", "us-central1"],
    ["eur3", "europe-west1"],
  ])("maps the multi-region location %s to %s", (location, region) => {
    expect(firestoreLocationToFunctionRegion(location)).toBe(region);
  });

  test.each(["us-central1", "europe-west1", "asia-northeast1", "us-east1"])(
    "passes the regional location %s through unchanged",
    (location) => {
      expect(firestoreLocationToFunctionRegion(location)).toBe(location);
    }
  );

  test("returns undefined for an unset location", () => {
    expect(firestoreLocationToFunctionRegion(undefined)).toBeUndefined();
  });

  test("returns undefined for an empty location", () => {
    expect(firestoreLocationToFunctionRegion("")).toBeUndefined();
  });
});

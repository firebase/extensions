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

import { bucketLocationToFunctionRegion } from "../src/region";

describe("bucketLocationToFunctionRegion", () => {
  test.each([
    ["us", "us-east1"],
    ["eu", "europe-west1"],
    ["asia", "asia-east1"],
  ])("maps the multi-region location %s to %s", (location, region) => {
    expect(bucketLocationToFunctionRegion(location)).toBe(region);
  });

  test.each(["us-central1", "europe-west1", "asia-northeast1", "us-east1"])(
    "passes the regional location %s through unchanged",
    (location) => {
      expect(bucketLocationToFunctionRegion(location)).toBe(location);
    }
  );

  test("returns undefined for an unset location", () => {
    expect(bucketLocationToFunctionRegion(undefined)).toBeUndefined();
  });

  test("returns undefined for an empty location", () => {
    expect(bucketLocationToFunctionRegion("")).toBeUndefined();
  });

  test("returns undefined for a whitespace-only location", () => {
    expect(bucketLocationToFunctionRegion("   ")).toBeUndefined();
  });

  test.each([
    ["US", "us-east1"],
    ["Eu", "europe-west1"],
    [" asia ", "asia-east1"],
  ])("normalizes %s before the multi-region lookup", (location, region) => {
    expect(bucketLocationToFunctionRegion(location)).toBe(region);
  });

  test("lowercases and trims a regional location", () => {
    expect(bucketLocationToFunctionRegion(" Europe-West2 ")).toBe(
      "europe-west2"
    );
  });
});

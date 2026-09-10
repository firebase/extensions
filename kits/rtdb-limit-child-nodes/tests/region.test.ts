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

import { normalizeRegion } from "../src/region";

describe("normalizeRegion", () => {
  test.each(["us-central1", "europe-west1", "asia-southeast1"])(
    "passes the database location %s through unchanged",
    (location) => {
      expect(normalizeRegion(location)).toBe(location);
    }
  );

  test("lowercases and trims a location", () => {
    expect(normalizeRegion(" Europe-West1 ")).toBe("europe-west1");
  });

  test("returns undefined for an unset location", () => {
    expect(normalizeRegion(undefined)).toBeUndefined();
  });

  test("returns undefined for an empty location", () => {
    expect(normalizeRegion("")).toBeUndefined();
  });

  test("returns undefined for a whitespace-only location", () => {
    expect(normalizeRegion("   ")).toBeUndefined();
  });
});

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

import { afterEach, describe, expect, test } from "vitest";

import { envFunctionRegion } from "../src/config";

const original = process.env.BUCKET_REGION;

function setBucketRegion(value?: string): void {
  if (value === undefined) {
    delete process.env.BUCKET_REGION;
  } else {
    process.env.BUCKET_REGION = value;
  }
}

afterEach(() => {
  setBucketRegion(original);
});

describe("envFunctionRegion function region", () => {
  test.each([
    ["us", "us-east1"],
    ["eu", "europe-west1"],
    ["asia", "asia-east1"],
  ])(
    "multi-region BUCKET_REGION %s places the function in %s",
    (loc, region) => {
      setBucketRegion(loc);
      expect(envFunctionRegion()).toBe(region);
    }
  );

  test("a regional BUCKET_REGION places the function in that region", () => {
    setBucketRegion("europe-west4");
    expect(envFunctionRegion()).toBe("europe-west4");
  });

  test("an unset location yields no region", () => {
    setBucketRegion(undefined);
    expect(envFunctionRegion()).toBeUndefined();
  });

  test("an empty location yields no region", () => {
    setBucketRegion("");
    expect(envFunctionRegion()).toBeUndefined();
  });
});

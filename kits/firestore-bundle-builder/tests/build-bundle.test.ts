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

import { HttpsError } from "firebase-functions/v1/https";
import { describe, expect, test } from "vitest";
import {
  type ParamsSpec,
  parameterize,
  parameterizePath,
} from "../src/build-bundle";

describe("parameterize", () => {
  const params: ParamsSpec = {
    name: { type: "string" },
    age: { type: "integer" },
    score: { type: "float" },
    active: { type: "boolean" },
    req: { type: "string", required: true },
  };

  test("returns non-parameter values unchanged", () => {
    expect(parameterize("literal", params, {})).toBe("literal");
    expect(parameterize(123, params, {})).toBe(123);
  });

  test("resolves string params", () => {
    expect(parameterize("$name", params, { name: "ada" })).toBe("ada");
  });

  test("coerces integer params", () => {
    expect(parameterize("$age", params, { age: "42" })).toBe(42);
  });

  test("coerces float params", () => {
    expect(parameterize("$score", params, { score: "3.5" })).toBe(3.5);
  });

  test("coerces boolean params", () => {
    expect(parameterize("$active", params, { active: "true" })).toBe(true);
    expect(parameterize("$active", params, { active: "false" })).toBe(false);
  });

  test("throws when a required param is missing", () => {
    expect(() => parameterize("$req", params, {})).toThrow(
      "Required param 'req' was missing."
    );
  });
});

describe("parameterizePath", () => {
  test("should successfully parameterize valid single-segment values", () => {
    const res = parameterizePath(
      "stores/$city/products",
      { city: { type: "string", required: true } },
      { city: "austin" }
    );
    expect(res).toEqual("stores/austin/products");
  });

  test("should throw an error when parameter values contain forward slashes", () => {
    expect(() =>
      parameterizePath(
        "stores/$city/products",
        { city: { type: "string", required: true } },
        { city: "austin/private/salaries" }
      )
    ).toThrow(HttpsError);
  });

  const spec: ParamsSpec = {
    UID: { type: "string" },
    FRIEND: { type: "string" },
  };

  test("should allow valid values", () => {
    expect(
      parameterizePath("users/$UID/friends/$FRIEND", spec, {
        UID: "user1",
        FRIEND: "friend1",
      })
    ).toEqual("users/user1/friends/friend1");
  });

  test("should prohibit path injection", () => {
    expect(() =>
      parameterizePath("users/$UID", spec, { UID: "user/private/data" })
    ).toThrow(HttpsError);
  });

  test("should reject empty path paremeters (parent collection lookup)", () => {
    expect(() =>
      parameterizePath("users/$UID/friends/$FRIEND", spec, {})
    ).toThrow(HttpsError);
  });
});

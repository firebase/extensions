/*
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

import { Expression } from "firebase-functions/params";
import { describe, expect, test } from "vitest";

import { envDeployOptions } from "../src/config";

/**
 * These assert the CEL the params path emits into the deploy manifest. The bug
 * this guards against is resolving params with `.value()` at the module scope,
 * which freezes the deploy-time default (`region: "us-central1"`) into the
 * manifest instead of leaving a `{{ params.LOCATION }}` expression the Firebase
 * CLI resolves after loading `.env` / prompting.
 */
const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  const options = envDeployOptions();

  test("region is a param expression, not a frozen default", () => {
    expect(cel(options.region)).toBe("{{ params.LOCATION }}");
  });

  test("no deploy-time option is a frozen undefined/empty literal", () => {
    for (const value of Object.values(options)) {
      expect(value).toBeInstanceOf(Expression);
      expect(cel(value)).not.toContain("undefined");
    }
  });
});

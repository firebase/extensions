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
 * which freezes deploy-time defaults (e.g. an empty `bucket`, binding the
 * trigger to the wrong bucket) instead of leaving a `{{ params.X }}` expression
 * the Firebase CLI resolves after loading `.env` / prompting.
 */
const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  const options = envDeployOptions();

  test("bucket is a param expression, not a frozen default", () => {
    expect(options.bucket).toBeInstanceOf(Expression);
    expect(cel(options.bucket)).toBe("{{ params.EXTENSION_BUCKET }}");
  });

  test("does not set a function region", () => {
    expect(options).not.toHaveProperty("region");
  });

  test("timeout and memory pass through as literal defaults", () => {
    expect(options.timeoutSeconds).toBe(540);
    expect(options.memory).toBe("1GiB");
  });

  test("no trigger-binding deploy option freezes to undefined", () => {
    expect(cel(options.bucket)).not.toContain("undefined");
  });
});

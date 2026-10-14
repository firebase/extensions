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

const TEST_PROJECT_ID = "test-project";

/**
 * These assert the CEL the params path emits into the deploy manifest. The bug
 * this guards against is resolving params with `.value()` at the module scope,
 * which freezes deploy-time defaults (e.g. the default `COLLECTION_NAME`) into
 * the manifest instead of leaving a `{{ params.X }}` expression the Firebase CLI
 * resolves after loading `.env` / prompting.
 */
const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: TEST_PROJECT_ID });
  const options = envDeployOptions();

  test("document defers the collection path and keeps the message wildcard", () => {
    expect(cel(options.document)).toBe(
      "{{ params.COLLECTION_NAME }}/{messageId}"
    );
  });

  test("does not set a function region", () => {
    expect(options).not.toHaveProperty("region");
  });

  test("declares the extension's 540s timeout", () => {
    expect(options.timeoutSeconds).toBe(540);
  });

  test("document expression is not a frozen undefined/empty literal", () => {
    expect(options.document).toBeInstanceOf(Expression);
    expect(cel(options.document)).not.toContain("undefined");
  });
});

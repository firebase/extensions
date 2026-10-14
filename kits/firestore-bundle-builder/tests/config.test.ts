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

import { declaredParams } from "firebase-functions/params";
import { describe, expect, test } from "vitest";
import "../src/config";

function text(name: string): Record<string, unknown> {
  const param = declaredParams.find((candidate) => candidate.name === name) as
    | { options?: { input?: { text?: Record<string, unknown> } } }
    | undefined;

  return param?.options?.input?.text ?? {};
}

// `Param.toSpec()` rewrites a declared RegExp to its source string in place,
// so a declaration read after discovery can hold either form.
function validationRegex(name: string): RegExp {
  const declared = text(name).validationRegex as RegExp | string;

  return typeof declared === "string" ? new RegExp(declared) : declared;
}

/**
 * Compatibility requirement: the extension marks `BUNDLESPEC_COLLECTION`
 * `required: true`, so its installer refuses an empty answer and re-prompts,
 * and it validates `BUNDLE_STORAGE_BUCKET` against a regex the kit had
 * dropped. The CLI enforces either one for a kit only when the declaration
 * carries it.
 */
describe("validation inherited from the extension", () => {
  test("BUNDLESPEC_COLLECTION refuses an empty value at the prompt", () => {
    expect(text("BUNDLESPEC_COLLECTION").nonEmpty).toBe(true);
  });

  test("BUNDLE_STORAGE_BUCKET keeps the extension's bucket validation", () => {
    const regex = validationRegex("BUNDLE_STORAGE_BUCKET");

    expect(regex.source).toBe(/^([0-9a-z_.-]*)$/.source);
    expect(regex.test("my-project-12345.appspot.com")).toBe(true);
    expect(regex.test("My Bucket")).toBe(false);
  });

  // The extension leaves the bucket optional and its regex matches "", so the
  // kit must not tighten it: an existing .env may carry an empty value.
  test("BUNDLE_STORAGE_BUCKET still accepts an empty value", () => {
    const regex = validationRegex("BUNDLE_STORAGE_BUCKET");

    expect(regex.test("")).toBe(true);
    expect(text("BUNDLE_STORAGE_BUCKET").nonEmpty).toBeUndefined();
  });
});

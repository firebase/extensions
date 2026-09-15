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

// config.test.ts fakes firebase-functions/params and drops the declaration
// options, so these cases read the real declarations instead.
function text(name: string): Record<string, unknown> {
  const param = declaredParams.find((candidate) => candidate.name === name) as
    | { options?: { input?: { text?: Record<string, unknown> } } }
    | undefined;

  return param?.options?.input?.text ?? {};
}

/**
 * Compatibility requirement: extension.yaml marks both params `required: true`,
 * so the extension's installer refuses an empty answer and re-prompts. The CLI
 * enforces that for a kit only when the declaration says `nonEmpty`.
 */
describe("params the extension marks required", () => {
  test.each(["BIGQUERY_PROJECT_ID", "DATABASE"])(
    "%s refuses an empty value at the prompt",
    (name) => {
      expect(text(name).nonEmpty).toBe(true);
    }
  );
});

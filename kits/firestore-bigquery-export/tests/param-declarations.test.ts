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

/**
 * Deploy-time prompt shapes, pinned against the extension's `extension.yaml`.
 * `config.test.ts` fakes `firebase-functions/params`, so this runs against the
 * real params.
 */

import { declaredParams } from "firebase-functions/params";
import { describe, expect, test } from "vitest";

import "../src/config";

function declaration(name: string) {
  const param = declaredParams.find((candidate) => candidate.name === name);
  if (!param || !("options" in param)) {
    throw new Error(`Missing declaration for ${name}`);
  }
  const options = param.options as { default?: unknown; input?: unknown };
  return {
    type: (param.constructor as unknown as { type: string }).type,
    default: options.default,
    input: options.input,
  };
}

describe("WILDCARD_IDS", () => {
  test("declares the predecessor's labeled boolean select", () => {
    expect(declaration("WILDCARD_IDS")).toEqual({
      type: "boolean",
      default: false,
      input: {
        select: {
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
    });
  });
});

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
 * Compatibility requirement, not aspiration: the extension declared
 * `ENABLE_AUTOMATIC_PUNCTUATION` as an Enabled / Disabled select carrying the
 * literal values `true` / `false`, and read it as
 * `process.env.ENABLE_AUTOMATIC_PUNCTUATION === "true"`, so an unset variable
 * meant disabled despite the declared default of `true`. `BooleanParam`
 * resolves identically (`runtimeValue()` is `env === "true"`, the default only
 * drives the deploy-time prompt), so the kit keeps the boolean param and
 * carries the extension's labels through a `select<boolean>`.
 */

import { declaredParams } from "firebase-functions/params";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { configFromEnv } from "../src/config";

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

describe("ENABLE_AUTOMATIC_PUNCTUATION values inherited from the extension", () => {
  let saved: string | undefined;

  test("declares the predecessor's labeled boolean select", () => {
    expect(declaration("ENABLE_AUTOMATIC_PUNCTUATION")).toEqual({
      type: "boolean",
      default: true,
      input: {
        select: {
          options: [
            { label: "Enabled", value: true },
            { label: "Disabled", value: false },
          ],
        },
      },
    });
  });

  beforeEach(() => {
    saved = process.env.ENABLE_AUTOMATIC_PUNCTUATION;
    delete process.env.ENABLE_AUTOMATIC_PUNCTUATION;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.ENABLE_AUTOMATIC_PUNCTUATION;
    } else {
      process.env.ENABLE_AUTOMATIC_PUNCTUATION = saved;
    }
  });

  test("reads the Enabled/Disabled option values", () => {
    process.env.ENABLE_AUTOMATIC_PUNCTUATION = "true";
    expect(configFromEnv().enableAutomaticPunctuation).toBe(true);

    process.env.ENABLE_AUTOMATIC_PUNCTUATION = "false";
    expect(configFromEnv().enableAutomaticPunctuation).toBe(false);
  });

  test("treats an unset variable as disabled, as the extension did", () => {
    expect(configFromEnv().enableAutomaticPunctuation).toBe(false);
  });
});

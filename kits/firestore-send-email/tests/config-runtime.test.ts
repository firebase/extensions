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
 * `OAUTH_SECURE` as a `true` / `false` select and read it as
 * `process.env.OAUTH_SECURE === "true"`, so an unset variable meant an
 * insecure connection despite the declared default of `true`.
 * `config.test.ts` fakes `firebase-functions/params`, so this runs against the
 * real params.
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

describe("OAUTH_SECURE values inherited from the extension", () => {
  let saved: string | undefined;

  test("declares the predecessor's labeled string select", () => {
    expect(declaration("OAUTH_SECURE")).toEqual({
      type: "string",
      default: "true",
      input: {
        select: {
          options: [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ],
        },
      },
    });
  });

  beforeEach(() => {
    saved = process.env.OAUTH_SECURE;
    delete process.env.OAUTH_SECURE;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.OAUTH_SECURE;
    } else {
      process.env.OAUTH_SECURE = saved;
    }
  });

  test("reads OAUTH_SECURE as true/false", () => {
    process.env.OAUTH_SECURE = "true";
    expect(configFromEnv().oauthSecure).toBe(true);

    process.env.OAUTH_SECURE = "false";
    expect(configFromEnv().oauthSecure).toBe(false);
  });

  test("treats an unset variable as insecure, as the extension did", () => {
    expect(configFromEnv().oauthSecure).toBe(false);
  });
});

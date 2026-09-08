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
 * Compatibility requirement, not aspiration: the extension declared both
 * backfill toggles as required `true` / `false` selects, so a deployed `.env`
 * carries those literal values.
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

const KEYS = ["DO_BACKFILL", "UPDATE_ON_CONFIGURE"] as const;

describe("select values inherited from the extension", () => {
  const saved = new Map<string, string | undefined>();

  test("declares the predecessor's required labeled boolean selects", () => {
    for (const name of ["DO_BACKFILL", "UPDATE_ON_CONFIGURE"]) {
      expect(declaration(name)).toEqual({
        type: "boolean",
        default: undefined,
        input: {
          select: {
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
        },
      });
    }
  });

  beforeEach(() => {
    for (const key of KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    saved.clear();
  });

  test("reads DO_BACKFILL as true/false", () => {
    process.env.DO_BACKFILL = "true";
    expect(configFromEnv().doBackfill).toBe(true);

    process.env.DO_BACKFILL = "false";
    expect(configFromEnv().doBackfill).toBe(false);
  });

  test("reads UPDATE_ON_CONFIGURE as true/false", () => {
    process.env.UPDATE_ON_CONFIGURE = "true";
    expect(configFromEnv().updateOnConfigure).toBe(true);

    process.env.UPDATE_ON_CONFIGURE = "false";
    expect(configFromEnv().updateOnConfigure).toBe(false);
  });

  test("treats an unset variable as off, as the extension did", () => {
    const config = configFromEnv();

    expect(config.doBackfill).toBe(false);
    expect(config.updateOnConfigure).toBe(false);
  });
});

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
 * Compatibility requirement, not aspiration: the extension declared these
 * settings as two-option selects, so a deployed `.env` carries the extension's
 * literal option values. `config.test.ts` fakes `firebase-functions/params`,
 * so these cases run against the real params to pin the accepted values.
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

const KEYS = [
  "WILDCARD_IDS",
  "USE_NEW_SNAPSHOT_QUERY_SYNTAX",
  "EXCLUDE_OLD_DATA",
] as const;

describe("select values inherited from the extension", () => {
  const saved = new Map<string, string | undefined>();

  test("declares the predecessor's labeled string selects", () => {
    expect(declaration("WILDCARD_IDS")).toEqual({
      type: "string",
      default: "false",
      input: {
        select: {
          options: [
            { label: "No", value: "false" },
            { label: "Yes", value: "true" },
          ],
        },
      },
    });
    for (const name of ["USE_NEW_SNAPSHOT_QUERY_SYNTAX", "EXCLUDE_OLD_DATA"]) {
      expect(declaration(name)).toEqual({
        type: "string",
        default: "no",
        input: {
          select: {
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
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

  // WILDCARD_IDS was a true/false select; the other two were yes/no.
  test("reads WILDCARD_IDS as true/false", () => {
    process.env.WILDCARD_IDS = "true";
    expect(configFromEnv().wildcardIds).toBe(true);

    process.env.WILDCARD_IDS = "false";
    expect(configFromEnv().wildcardIds).toBe(false);
  });

  test("reads USE_NEW_SNAPSHOT_QUERY_SYNTAX as yes/no", () => {
    process.env.USE_NEW_SNAPSHOT_QUERY_SYNTAX = "yes";
    expect(configFromEnv().useNewSnapshotQuerySyntax).toBe(true);

    process.env.USE_NEW_SNAPSHOT_QUERY_SYNTAX = "no";
    expect(configFromEnv().useNewSnapshotQuerySyntax).toBe(false);
  });

  test("reads EXCLUDE_OLD_DATA as yes/no", () => {
    process.env.EXCLUDE_OLD_DATA = "yes";
    expect(configFromEnv().excludeOldData).toBe(true);

    process.env.EXCLUDE_OLD_DATA = "no";
    expect(configFromEnv().excludeOldData).toBe(false);
  });

  test("treats an unset variable as off, as the extension did", () => {
    const config = configFromEnv();

    expect(config.wildcardIds).toBe(false);
    expect(config.useNewSnapshotQuerySyntax).toBe(false);
    expect(config.excludeOldData).toBe(false);
  });
});

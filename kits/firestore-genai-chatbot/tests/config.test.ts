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
 * toggles as `yes` / `no` selects, so a deployed `.env` copied from an
 * installed instance carries those literal values.
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
  "ENABLE_DISCUSSION_OPTION_OVERRIDES",
  "ENABLE_GENKIT_MONITORING",
  "FIREBASE_CONFIG",
] as const;

describe("select values inherited from the extension", () => {
  const saved = new Map<string, string | undefined>();

  test("declares the predecessor's labeled string selects", () => {
    for (const name of [
      "ENABLE_DISCUSSION_OPTION_OVERRIDES",
      "ENABLE_GENKIT_MONITORING",
    ]) {
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
    // The project id resolves out of the runtime-injected FIREBASE_CONFIG.
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "demo-test" });
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

  test("reads ENABLE_DISCUSSION_OPTION_OVERRIDES as yes/no", () => {
    process.env.ENABLE_DISCUSSION_OPTION_OVERRIDES = "yes";
    expect(configFromEnv().enableOverrides).toBe(true);

    process.env.ENABLE_DISCUSSION_OPTION_OVERRIDES = "no";
    expect(configFromEnv().enableOverrides).toBe(false);
  });

  test("reads ENABLE_GENKIT_MONITORING as yes/no", () => {
    process.env.ENABLE_GENKIT_MONITORING = "yes";
    expect(configFromEnv().enableGenkitMonitoring).toBe(true);

    process.env.ENABLE_GENKIT_MONITORING = "no";
    expect(configFromEnv().enableGenkitMonitoring).toBe(false);
  });

  test("treats an unset variable as off, as the extension did", () => {
    const config = configFromEnv();

    expect(config.enableOverrides).toBe(false);
    expect(config.enableGenkitMonitoring).toBe(false);
  });
});

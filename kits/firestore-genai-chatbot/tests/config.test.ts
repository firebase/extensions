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
import { resolveConfig } from "../src/export-config";

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
  "VERTEX_AI_MODEL_LOCATION",
  "FUNCTION_REGION",
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

  /**
   * The extension stored the string "null" for "Same as Cloud Functions
   * Location", so a copied `.env` carries that literal value.
   */
  test("reads VERTEX_AI_MODEL_LOCATION=null as the function region", () => {
    process.env.VERTEX_AI_MODEL_LOCATION = "null";
    process.env.FUNCTION_REGION = "europe-west4";

    expect(configFromEnv().vertexModelLocation).toBeUndefined();
    expect(resolveConfig(configFromEnv()).vertex.modelLocation).toBe(
      "europe-west4"
    );
  });

  test("reads an explicit VERTEX_AI_MODEL_LOCATION over the function region", () => {
    process.env.VERTEX_AI_MODEL_LOCATION = "global";
    process.env.FUNCTION_REGION = "europe-west4";

    expect(resolveConfig(configFromEnv()).vertex.modelLocation).toBe("global");
  });
});

/**
 * Compatibility requirement: extension.yaml marks these `required: true`, so
 * the extension's installer refuses an empty answer and re-prompts, and it
 * validates `MODEL` against a regex the kit had dropped. The CLI enforces
 * either one for a kit only when the declaration carries it.
 */
describe("params the extension marks required", () => {
  function text(name: string): Record<string, unknown> {
    return (declaration(name).input as { text?: Record<string, unknown> })
      .text as Record<string, unknown>;
  }

  test.each(["MODEL", "PROMPT_FIELD", "RESPONSE_FIELD"])(
    "%s refuses an empty value at the prompt",
    (name) => {
      expect(text(name).nonEmpty).toBe(true);
    }
  );

  test("MODEL keeps the extension's model-id validation", () => {
    // `Param.toSpec()` rewrites a declared RegExp to its source string in
    // place, so a declaration read after discovery can hold either form.
    const declared = text("MODEL").validationRegex as RegExp | string;
    const regex =
      typeof declared === "string" ? new RegExp(declared) : declared;

    expect(regex.source).toBe(/^[a-zA-Z0-9][a-zA-Z0-9.\-_/]*$/.source);
    expect(regex.test("gemini-2.5-flash")).toBe(true);
    expect(regex.test("gemini 2.5 flash")).toBe(false);
  });
});

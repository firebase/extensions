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

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { declaredParams } from "firebase-functions/params";

const REQUIRED = ["EXTENSION_BUCKET", "LANGUAGE_CODE", "MODEL"];

const OPTIONAL = [
  "OUTPUT_STORAGE_PATH",
  "COLLECTION_PATH",
  "ENABLE_AUTOMATIC_PUNCTUATION",
];

let assertRequiredParams: (names?: ReadonlyArray<string>) => void;

beforeAll(async () => {
  // Some kits resolve the instance id at import; the CLI injects it for real
  // instances, so supply one before loading the module under test.
  process.env.FIREBASE_KIT_INSTANCE_ID ??= "test-instance";
  ({ assertRequiredParams } = await import("../src/config"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertRequiredParams", () => {
  test("passes when no params have been supplied yet", () => {
    expect(() => assertRequiredParams()).not.toThrow();
  });

  test("passes when every required param holds a value", () => {
    for (const name of REQUIRED) {
      vi.stubEnv(name, "set");
    }

    expect(() => assertRequiredParams()).not.toThrow();
  });

  test("rejects required params blanked in .env, naming each one", () => {
    for (const name of REQUIRED) {
      vi.stubEnv(name, "");
    }

    expect(() => assertRequiredParams()).toThrow(REQUIRED.join(", "));
  });

  test("rejects a whitespace-only value, which the CLI prompt accepts", () => {
    vi.stubEnv(REQUIRED[0], "   ");

    expect(() => assertRequiredParams()).toThrow(REQUIRED[0]);
  });

  test("ignores optional params left blank", () => {
    for (const name of OPTIONAL) {
      vi.stubEnv(name, "");
    }

    expect(() => assertRequiredParams()).not.toThrow();
  });
});

type Declaration = {
  name: string;
  options?: {
    default?: unknown;
    input?: {
      text?: { nonEmpty?: boolean; validationRegex?: string | RegExp };
      multiSelect?: { nonEmpty?: boolean };
    };
  };
};

// The CLI writes whatever a prompt resolves to into .env, an empty answer
// included, so a required param the prompt accepts empty reaches
// assertRequiredParams as a blank entry the user never typed.
function promptAcceptsEmpty({ options }: Declaration): boolean {
  const fallback = options?.default;
  if (fallback !== undefined && String(fallback).trim() !== "") {
    return false;
  }

  const input = options?.input;
  if (!input) {
    return true;
  }
  if (input.multiSelect) {
    return input.multiSelect.nonEmpty !== true;
  }
  if (!input.text) {
    return false;
  }
  if (input.text.nonEmpty) {
    return false;
  }
  if (input.text.validationRegex) {
    return new RegExp(input.text.validationRegex).test("");
  }
  return true;
}

describe("required param declarations", () => {
  test("the CLI prompt cannot resolve any of them to an empty value", () => {
    const declarations = declaredParams as unknown as Declaration[];

    for (const name of REQUIRED) {
      const declaration = declarations.find((param) => param.name === name);

      expect(declaration, name).toBeDefined();
      expect(promptAcceptsEmpty(declaration as Declaration), name).toBe(false);
    }
  });
});

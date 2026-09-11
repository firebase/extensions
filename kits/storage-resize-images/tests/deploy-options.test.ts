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
 * Parity with the extension's `__tests__/function.test.ts` (the function is
 * exported and constructible), plus the deploy-manifest assertions the
 * extension gets for free from `extension.yaml`.
 *
 * The bug these guard against is resolving params with `.value()` at module
 * scope, which freezes deploy-time defaults — for `bucket` that binds the
 * trigger to the wrong bucket — instead of leaving a `{{ params.X }}`
 * expression the Firebase CLI resolves after loading `.env`.
 */

import { Expression } from "firebase-functions/params";
import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const actual = await vi.importActual<typeof import("firebase-admin")>(
    "firebase-admin"
  );
  return {
    ...actual,
    apps: [],
    initializeApp: vi.fn(),
    storage: vi.fn(() => ({ bucket: vi.fn(() => ({})) })),
  };
});

import { CONFIG_EXPRESSIONS } from "../src/config";
import { generateResizedImage } from "../src/index";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("generateResizedImage", () => {
  test("is exported as a callable function", () => {
    expect(generateResizedImage).toBeInstanceOf(Function);
  });

  test("re-exports the library surface alongside the function", async () => {
    const index = await import("../src/index");
    expect(index.generateResizedImageHandler).toBeInstanceOf(Function);
    expect(index.resolveResizeImagesConfig).toBeInstanceOf(Function);
    expect(index.shouldResize).toBeInstanceOf(Function);
  });
});

describe("CONFIG_EXPRESSIONS", () => {
  test("bucket is a param expression, not a frozen default", () => {
    expect(CONFIG_EXPRESSIONS.bucket).toBeInstanceOf(Expression);
    expect(cel(CONFIG_EXPRESSIONS.bucket)).toBe("{{ params.IMG_BUCKET }}");
  });

  test("memory is a param expression, not a frozen default", () => {
    expect(CONFIG_EXPRESSIONS.memory).toBeInstanceOf(Expression);
    expect(cel(CONFIG_EXPRESSIONS.memory)).toBe("{{ params.FUNCTION_MEMORY }}");
  });

  test("no trigger-binding deploy option freezes to undefined", () => {
    expect(cel(CONFIG_EXPRESSIONS.bucket)).not.toContain("undefined");
    expect(cel(CONFIG_EXPRESSIONS.memory)).not.toContain("undefined");
  });
});

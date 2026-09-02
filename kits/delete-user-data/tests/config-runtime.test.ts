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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configFromEnv } from "../src/config";
import { resolveDeleteUserDataConfig } from "../src/export-config";

// config.test.ts fakes firebase-functions/params, so it cannot see how the real
// IntParam resolves a missing env var. These cases run against the real one.
function resolvedSearchDepth(raw?: string): number {
  if (raw === undefined) {
    delete process.env.AUTO_DISCOVERY_SEARCH_DEPTH;
  } else {
    process.env.AUTO_DISCOVERY_SEARCH_DEPTH = raw;
  }
  return resolveDeleteUserDataConfig(configFromEnv()).searchDepth;
}

describe("searchDepth from the runtime environment", () => {
  const original = process.env.AUTO_DISCOVERY_SEARCH_DEPTH;

  beforeEach(() => {
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", "test-instance");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (original === undefined) {
      delete process.env.AUTO_DISCOVERY_SEARCH_DEPTH;
    } else {
      process.env.AUTO_DISCOVERY_SEARCH_DEPTH = original;
    }
  });

  test("falls back to the documented default when unset", () => {
    expect(resolvedSearchDepth(undefined)).toBe(3);
  });

  // An extension .env that left the value empty resolved to 3, not 0.
  test("falls back to the documented default when blank", () => {
    expect(resolvedSearchDepth("")).toBe(3);
  });

  // A quoted "   " survives the CLI's .env parser untrimmed.
  test("falls back to the documented default when whitespace only", () => {
    expect(resolvedSearchDepth("   ")).toBe(3);
  });

  test("preserves an explicit zero", () => {
    expect(resolvedSearchDepth("0")).toBe(0);
  });

  test("preserves an explicit depth", () => {
    expect(resolvedSearchDepth("5")).toBe(5);
  });
});

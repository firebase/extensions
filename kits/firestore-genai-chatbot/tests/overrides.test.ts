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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("../src/logger", () => ({ logger: { error: mocks.error } }));

import { extractOverrides } from "../src/overrides";

/** A fake discussion document snapshot carrying `data`. */
function snap(data: Record<string, unknown>): DocumentSnapshot {
  return { data: () => data } as unknown as DocumentSnapshot;
}

describe("extractOverrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("extracts string fields", () => {
    const overrides = extractOverrides(
      snap({ context: "testContext", model: "testModel" })
    );

    expect(overrides).toEqual({ context: "testContext", model: "testModel" });
  });

  test("coerces integer fields from strings and keeps numbers", () => {
    const overrides = extractOverrides(
      snap({
        topK: "10",
        candidateCount: 5,
        maxOutputTokens: "1024",
      })
    );

    expect(overrides).toEqual({
      topK: 10,
      candidateCount: 5,
      maxOutputTokens: 1024,
    });
  });

  test("coerces float fields from strings and keeps numbers", () => {
    const overrides = extractOverrides(snap({ topP: "0.9", temperature: 0.7 }));

    expect(overrides).toEqual({ topP: 0.9, temperature: 0.7 });
  });

  test("drops fields that are not overrides", () => {
    const overrides = extractOverrides(
      snap({ model: "testModel", examples: [{ prompt: "p", response: "r" }] })
    );

    expect(overrides).toEqual({ model: "testModel" });
  });

  test("returns an empty object when the discussion doc has no overrides", () => {
    expect(extractOverrides(snap({}))).toEqual({});
  });

  test("throws and logs when a field has the wrong type", () => {
    expect(() => extractOverrides(snap({ context: 123 }))).toThrow(
      "Error parsing overrides from parent doc."
    );
    expect(mocks.error).toHaveBeenCalledOnce();
  });

  test("drops an integer field whose string value is not numeric", () => {
    const overrides = extractOverrides(snap({ topK: "not-a-number" }));

    expect(overrides.topK).toBeUndefined();
  });

  test("drops an integer field whose string value is zero", () => {
    const overrides = extractOverrides(snap({ topK: "0" }));

    expect(overrides.topK).toBeUndefined();
  });

  test("lets NaN through for a float field whose string value is not numeric", () => {
    const overrides = extractOverrides(snap({ temperature: "not-a-number" }));

    expect(Number.isNaN(overrides.temperature)).toBe(true);
  });
});

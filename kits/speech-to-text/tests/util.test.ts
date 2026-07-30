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

import { describe, expect, test } from "vitest";

import { errorFromAny, getTranscriptionsByChannel } from "../src/util";

describe("errorFromAny", () => {
  test("returns the same Error instance", () => {
    const err = new Error("boom");
    expect(errorFromAny(err)).toBe(err);
  });

  test("wraps a non-error value", () => {
    const wrapped = errorFromAny("oops");
    expect(wrapped.name).toBe("Thrown non-error object");
    expect(wrapped.message).toBe("oops");
  });
});

describe("getTranscriptionsByChannel", () => {
  test("groups transcripts by channel tag", () => {
    const result = getTranscriptionsByChannel([
      { channelTag: 1, alternatives: [{ transcript: "hello" }] },
      { channelTag: 2, alternatives: [{ transcript: "world" }] },
      { channelTag: 1, alternatives: [{ transcript: "again" }] },
    ]);

    expect(result).toEqual({ 1: ["hello", "again"], 2: ["world"] });
  });

  test("returns null when a result lacks a channel tag", () => {
    const result = getTranscriptionsByChannel([
      { alternatives: [{ transcript: "hello" }] },
    ]);

    expect(result).toBeNull();
  });

  test("returns null (does not throw) when alternatives is an empty array", () => {
    expect(() =>
      getTranscriptionsByChannel([{ channelTag: 1, alternatives: [] }])
    ).not.toThrow();

    expect(
      getTranscriptionsByChannel([{ channelTag: 1, alternatives: [] }])
    ).toBeNull();
  });
});

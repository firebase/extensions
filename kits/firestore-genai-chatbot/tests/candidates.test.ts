/*
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

import { describe, expect, it } from "vitest";
import { wantsMultipleCandidates } from "../src/candidates";
import { answerText } from "../src/generative-client/parts";

describe("wantsMultipleCandidates", () => {
  it("is true for a count above one with a field to write to", () => {
    expect(
      wantsMultipleCandidates({
        candidateCount: 2,
        candidatesField: "candidates",
      })
    ).toBe(true);
  });

  it("is false for a single candidate", () => {
    expect(
      wantsMultipleCandidates({
        candidateCount: 1,
        candidatesField: "candidates",
      })
    ).toBe(false);
  });

  it("is false without a candidates field, so the request is not wasted", () => {
    expect(wantsMultipleCandidates({ candidateCount: 2 })).toBe(false);
  });

  it("is false for an unset count", () => {
    expect(wantsMultipleCandidates({ candidatesField: "candidates" })).toBe(
      false
    );
  });
});

describe("answerText", () => {
  it("returns the only text part", () => {
    expect(answerText([{ text: "answer" }])).toBe("answer");
  });

  it("skips a leading thought part", () => {
    expect(
      answerText([
        { text: "thinking out loud", thought: true },
        { text: "answer" },
      ])
    ).toBe("answer");
  });

  it("returns undefined when every part is a thought", () => {
    expect(answerText([{ text: "thinking", thought: true }])).toBeUndefined();
  });

  it("returns undefined for missing or empty parts", () => {
    expect(answerText(undefined)).toBeUndefined();
    expect(answerText([])).toBeUndefined();
    expect(answerText([{}])).toBeUndefined();
  });
});

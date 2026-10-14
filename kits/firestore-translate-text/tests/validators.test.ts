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

import { fieldNameIsTranslationPath, fieldNamesMatch } from "../src/validators";

describe("fieldNamesMatch", () => {
  test("is true when both field names are identical", () => {
    expect(fieldNamesMatch("input", "input")).toBe(true);
  });

  test("is false for distinct field names", () => {
    expect(fieldNamesMatch("input", "translated")).toBe(false);
  });
});

describe("fieldNameIsTranslationPath", () => {
  const languages = ["en", "es", "de", "fr"];

  test("is true when the input field is an output language path", () => {
    expect(
      fieldNameIsTranslationPath("translated.en", "translated", languages)
    ).toBe(true);
    expect(
      fieldNameIsTranslationPath("translated.fr", "translated", languages)
    ).toBe(true);
  });

  test("is false for a language outside the configured set", () => {
    expect(
      fieldNameIsTranslationPath("translated.pt", "translated", languages)
    ).toBe(false);
  });

  test("is false for an unrelated nested field", () => {
    expect(
      fieldNameIsTranslationPath("input.en", "translated", languages)
    ).toBe(false);
  });

  test("is false when no languages are configured", () => {
    expect(fieldNameIsTranslationPath("translated.en", "translated", [])).toBe(
      false
    );
  });
});

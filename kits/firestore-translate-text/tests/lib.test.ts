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

import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions", () => import("./mocks/firebase-functions"));
vi.mock("@google-cloud/translate", () => import("./mocks/translate"));
vi.mock("genkit", () => import("./mocks/genkit"));
vi.mock("@genkit-ai/google-genai", () => import("./mocks/google-genai"));

vi.mock("firebase-functions/params", () => {
  throw new Error("./lib must not import firebase-functions/params");
});

describe("./lib", () => {
  test("imports without declaring Firebase params", async () => {
    const lib = await import("../src/lib");

    expect(lib.resolveTranslateConfig).toBeTypeOf("function");
    expect(lib.handleDocumentWrite).toBeTypeOf("function");
    expect(lib.createTranslationService).toBeTypeOf("function");
    expect(lib.translateDocument).toBeTypeOf("function");
    expect(lib.translateSingle).toBeTypeOf("function");
    expect(lib.translateMultiple).toBeTypeOf("function");
    expect(lib.TranslationService).toBeTypeOf("function");
    expect(lib.GoogleTranslator).toBeTypeOf("function");
    expect(lib.GenkitTranslator).toBeTypeOf("function");
  }, 15000);
});

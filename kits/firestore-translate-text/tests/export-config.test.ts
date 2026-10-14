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

import { afterEach, describe, expect, test, vi } from "vitest";

import { resolveTranslateConfig } from "../src/export-config";

const baseConfig = {
  collectionPath: "translations",
  inputFieldName: "input",
  outputFieldName: "translated",
  languages: "en,es,de,fr",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveTranslateConfig", () => {
  test("applies defaults for optional fields", () => {
    expect(resolveTranslateConfig(baseConfig)).toEqual({
      collectionPath: "translations",
      inputFieldName: "input",
      outputFieldName: "translated",
      languages: ["en", "es", "de", "fr"],
      languagesFieldName: undefined,
      provider: "translate",
      useGenkit: false,
      geminiProvider: "vertexai",
      geminiModel: "gemini-2.5-flash",
      googleAiApiKey: undefined,
      region: undefined,
      projectId: undefined,
    });
  });

  // Parity with the extension's "removes any duplicated languages from user
  // input" test, which asserted on the `LANGUAGES` env var being de-duplicated.
  test("removes any duplicated languages from user input", () => {
    expect(
      resolveTranslateConfig({ ...baseConfig, languages: "en,es,de,fr,en" })
        .languages
    ).toEqual(["en", "es", "de", "fr"]);
  });

  test("accepts languages as an array as well as a comma-separated string", () => {
    expect(
      resolveTranslateConfig({
        ...baseConfig,
        languages: ["en", "es", "en"],
      }).languages
    ).toEqual(["en", "es"]);
  });

  test("marks gemini providers as genkit-backed", () => {
    const googleai = resolveTranslateConfig({
      ...baseConfig,
      provider: "gemini-googleai",
    });
    expect(googleai.useGenkit).toBe(true);
    expect(googleai.geminiProvider).toBe("googleai");

    const vertexai = resolveTranslateConfig({
      ...baseConfig,
      provider: "gemini-vertexai",
    });
    expect(vertexai.useGenkit).toBe(true);
    expect(vertexai.geminiProvider).toBe("vertexai");
  });

  test("leaves the Google Translate provider genkit-free", () => {
    const resolved = resolveTranslateConfig({
      ...baseConfig,
      provider: "translate",
    });

    expect(resolved.useGenkit).toBe(false);
    expect(resolved.provider).toBe("translate");
  });

  test("preserves explicit values", () => {
    const resolved = resolveTranslateConfig({
      ...baseConfig,
      languagesFieldName: "langs",
      provider: "gemini-googleai",
      geminiModel: "gemini-2.5-pro",
      googleAiApiKey: "api-key",
      region: "europe-west1",
      projectId: "fake-project",
    });

    expect(resolved.languagesFieldName).toBe("langs");
    expect(resolved.geminiModel).toBe("gemini-2.5-pro");
    expect(resolved.googleAiApiKey).toBe("api-key");
    expect(resolved.region).toBe("europe-west1");
    expect(resolved.projectId).toBe("fake-project");
  });

  test("falls back to FUNCTION_REGION when no region is supplied", () => {
    vi.stubEnv("FUNCTION_REGION", "us-central1");

    expect(resolveTranslateConfig(baseConfig).region).toBe("us-central1");
  });
});

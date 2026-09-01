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

class FakeExpression<_T = string> {
  constructor(private readonly cel: string) {}

  toCEL(): string {
    return this.cel;
  }
}

/**
 * Params resolve from the environment first so the suite can drive
 * `configFromEnv` the same way the extension's `config.test.ts` drives
 * `process.env` through `mocked-env`.
 */
class FakeStringParam extends FakeExpression<string> {
  constructor(readonly name: string, private readonly defaultValue?: string) {
    super(`{{ params.${name} }}`);
  }

  value(): string {
    return process.env[this.name] ?? this.defaultValue ?? "";
  }
}

const defineString = vi.fn(
  (name: string, opts?: { default?: string; input?: unknown }) =>
    new FakeStringParam(name, opts?.default)
);

const defineSecret = vi.fn((name: string) => ({
  name,
  value: () => process.env[name] ?? "",
}));

const select = vi.fn((options: unknown) => ({ select: { options } }));

const projectID = new FakeStringParam("PROJECT_ID", "fake-project");

const expr = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    new FakeExpression(
      strings.reduce(
        (result, part, index) =>
          result + part + (index < values.length ? cel(values[index]) : ""),
        ""
      )
    )
);

function cel(value: unknown): string {
  return value instanceof FakeExpression ? value.toCEL() : String(value);
}

vi.mock("firebase-functions/params", () => ({
  Expression: FakeExpression,
  defineSecret,
  defineString,
  expr,
  projectID,
  select,
}));

async function importConfig() {
  vi.resetModules();
  defineString.mockClear();
  defineSecret.mockClear();
  select.mockClear();
  expr.mockClear();

  return import("../src/config");
}

const ENV_KEYS = [
  "COLLECTION_PATH",
  "INPUT_FIELD_NAME",
  "OUTPUT_FIELD_NAME",
  "LANGUAGES",
  "LANGUAGES_FIELD_NAME",
  "TRANSLATION_PROVIDER",
  "GEMINI_MODEL",
  "FUNCTION_REGION",
];

beforeEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configFromEnv", () => {
  test("falls back to the documented parameter defaults", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv()).toEqual({
      collectionPath: "translations",
      inputFieldName: "input",
      outputFieldName: "translated",
      languages: "en,es,de,fr",
      languagesFieldName: "languages",
      provider: undefined,
      geminiModel: "gemini-2.5-flash",
      region: undefined,
      projectId: "fake-project",
    });
  });

  test("reads every parameter from the environment", async () => {
    vi.stubEnv("COLLECTION_PATH", "messages");
    vi.stubEnv("INPUT_FIELD_NAME", "text");
    vi.stubEnv("OUTPUT_FIELD_NAME", "translations");
    vi.stubEnv("LANGUAGES", "en,es,de,fr");
    vi.stubEnv("LANGUAGES_FIELD_NAME", "langs");
    vi.stubEnv("TRANSLATION_PROVIDER", "gemini-googleai");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-pro");
    vi.stubEnv("FUNCTION_REGION", "europe-west1");

    const { configFromEnv } = await importConfig();

    expect(configFromEnv()).toEqual({
      collectionPath: "messages",
      inputFieldName: "text",
      outputFieldName: "translations",
      languages: "en,es,de,fr",
      languagesFieldName: "langs",
      provider: "gemini-googleai",
      geminiModel: "gemini-2.5-pro",
      region: "europe-west1",
      projectId: "fake-project",
    });
  });

  test("treats empty optional params as unset", async () => {
    vi.stubEnv("LANGUAGES_FIELD_NAME", "");
    vi.stubEnv("TRANSLATION_PROVIDER", "");
    vi.stubEnv("GEMINI_MODEL", "");

    const { configFromEnv } = await importConfig();
    const config = configFromEnv();

    expect(config.languagesFieldName).toBeUndefined();
    expect(config.provider).toBeUndefined();
    expect(config.geminiModel).toBeUndefined();
  });

  test("declares the extension parameters", async () => {
    await importConfig();

    expect(defineString.mock.calls).toContainEqual([
      "COLLECTION_PATH",
      expect.objectContaining({ default: "translations" }),
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "INPUT_FIELD_NAME",
      expect.objectContaining({ default: "input" }),
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "OUTPUT_FIELD_NAME",
      expect.objectContaining({ default: "translated" }),
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "LANGUAGES",
      expect.objectContaining({ default: "en,es,de,fr" }),
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "LANGUAGES_FIELD_NAME",
      expect.objectContaining({ default: "languages" }),
    ]);
  });

  test("restores the extension's validation regexes", async () => {
    await importConfig();

    const options = new Map(
      defineString.mock.calls.map(([name, opts]) => [name, opts])
    );
    expect(options.get("LANGUAGES")).toMatchObject({
      input: { text: { validationRegex: /^[a-zA-Z,-]*[a-zA-Z-]{2,}$/ } },
    });
    expect(options.get("COLLECTION_PATH")).toMatchObject({
      input: { text: { validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/ } },
    });
  });

  test("offers the supported providers and gemini models as a select", async () => {
    await importConfig();

    const selectValues = select.mock.calls.map(([options]) =>
      Array.isArray(options) ? options : Object.values(options as object)
    );
    expect(selectValues).toContainEqual([
      "translate",
      "gemini-googleai",
      "gemini-vertexai",
    ]);
    expect(selectValues).toContainEqual([
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]);
  });
});

describe("CONFIG_EXPRESSIONS", () => {
  test("builds the document trigger from the collection path param", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    expect(cel(CONFIG_EXPRESSIONS.document)).toBe(
      "{{ params.COLLECTION_PATH }}/{messageId}"
    );
  });
});

describe("googleAiApiKey", () => {
  test("is declared as a secret param", async () => {
    const { googleAiApiKey } = await importConfig();

    expect(defineSecret).toHaveBeenCalledWith(
      "GOOGLE_AI_API_KEY",
      expect.objectContaining({ label: "Google AI API Key" })
    );
    expect((googleAiApiKey as unknown as { name: string }).name).toBe(
      "GOOGLE_AI_API_KEY"
    );
  });
});

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

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions", () => import("./mocks/firebase-functions"));
vi.mock("@google-cloud/translate", () => import("./mocks/translate"));
vi.mock("genkit", () => import("./mocks/genkit"));
vi.mock("@genkit-ai/google-genai", () => import("./mocks/google-genai"));
vi.mock("../src/events");

import * as events from "../src/events";
import { messages } from "../src/logs/messages";
import {
  createTranslationService,
  GenkitTranslator,
  GoogleTranslator,
  TranslationService,
} from "../src/translate";
import {
  defaultEnvironment,
  defaultLanguages,
  makeConfig,
  makeFirestore,
  makeSnapshot,
  testTranslations,
} from "./helpers";
import { logger, resetLoggerMocks } from "./mocks/firebase-functions";
import { generate, genkit, resetGenkitMocks } from "./mocks/genkit";
import {
  googleAI,
  resetGoogleGenaiMocks,
  vertexAI,
} from "./mocks/google-genai";
import {
  resetTranslateMocks,
  translateClass,
  translateClassMethod,
} from "./mocks/translate";

beforeEach(() => {
  vi.clearAllMocks();
  resetLoggerMocks();
  resetTranslateMocks();
  resetGenkitMocks();
  resetGoogleGenaiMocks();
});

describe("GoogleTranslator", () => {
  test("initializes the Google Translation API with the project id", () => {
    new GoogleTranslator(defaultEnvironment.PROJECT_ID);

    expect(translateClass).toHaveBeenCalledTimes(1);
    expect(translateClass).toHaveBeenCalledWith({
      projectId: defaultEnvironment.PROJECT_ID,
    });
  });

  test("returns the translated string and logs completion", async () => {
    const translator = new GoogleTranslator(defaultEnvironment.PROJECT_ID);

    await expect(translator.translate("hello", "de")).resolves.toBe(
      testTranslations.de
    );
    expect(translateClassMethod).toHaveBeenCalledWith("hello", "de");
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateStringComplete("hello", "de", testTranslations.de)
    );
  });

  test("logs, records and rethrows API errors", async () => {
    const error = new Error("Test Translation API Error");
    translateClassMethod.mockRejectedValueOnce(error);
    const translator = new GoogleTranslator(defaultEnvironment.PROJECT_ID);

    await expect(translator.translate("hello", "de")).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      ...messages.translateStringError("hello", "de", error)
    );
    expect(events.recordErrorEvent).toHaveBeenCalledWith(error);
  });
});

describe("GenkitTranslator", () => {
  test("requires a Google AI API key for the googleai provider", () => {
    expect(
      () => new GenkitTranslator(makeConfig({ provider: "gemini-googleai" }))
    ).toThrow(
      "Google AI API key is required for Genkit Google AI translations"
    );
  });

  test("registers the googleai plugin with the supplied API key", () => {
    new GenkitTranslator(
      makeConfig({ provider: "gemini-googleai", googleAiApiKey: "api-key" })
    );

    expect(googleAI).toHaveBeenCalledWith({ apiKey: "api-key" });
    expect(googleAI.model).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(genkit).toHaveBeenCalledTimes(1);
  });

  test("registers the vertexai plugin against the configured region", () => {
    new GenkitTranslator(
      makeConfig({ provider: "gemini-vertexai", geminiModel: "gemini-2.5-pro" })
    );

    expect(vertexAI).toHaveBeenCalledWith({
      location: defaultEnvironment.LOCATION,
    });
    expect(vertexAI.model).toHaveBeenCalledWith("gemini-2.5-pro");
  });

  test("registers the vertexai plugin without a location when no region is set", () => {
    new GenkitTranslator(
      makeConfig({ provider: "gemini-vertexai", region: "" })
    );

    expect(vertexAI).toHaveBeenCalledWith({});
  });

  test("returns the structured translation and logs completion", async () => {
    const translator = new GenkitTranslator(
      makeConfig({ provider: "gemini-vertexai" })
    );

    await expect(translator.translate("hello", "de")).resolves.toBe(
      "gemini translation"
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateStringComplete("hello", "de", "gemini translation")
    );
  });

  test("sanitizes quotes, backslashes and newlines in the prompt", async () => {
    const translator = new GenkitTranslator(
      makeConfig({ provider: "gemini-vertexai" })
    );

    await translator.translate('a "quoted"\nback\\slash', "de");

    const { prompt } = generate.mock.calls[0][0] as { prompt: string };
    expect(prompt).toContain('a \\"quoted\\" back\\\\slash');
    expect(prompt).toContain("Translate the following text to de");
  });

  test("throws when the model returns no structured output", async () => {
    generate.mockResolvedValueOnce({ output: undefined, text: "" } as any);
    const translator = new GenkitTranslator(
      makeConfig({ provider: "gemini-vertexai" })
    );

    await expect(translator.translate("hello", "de")).rejects.toThrow(
      "No translation returned from Gemini"
    );
    expect(events.recordErrorEvent).toHaveBeenCalled();
  });
});

describe("TranslationService", () => {
  const build = (overrides: Parameters<typeof makeConfig>[0] = {}) => {
    const firestore = makeFirestore();
    const translator = { translate: vi.fn(async () => "translated") };
    const service = new TranslationService(
      translator,
      makeConfig(overrides),
      firestore.firestore
    );
    return { firestore, translator, service };
  };

  test("delegates translateString to the translator", async () => {
    const { service, translator } = build();

    await expect(service.translateString("hello", "de")).resolves.toBe(
      "translated"
    );
    expect(translator.translate).toHaveBeenCalledWith("hello", "de");
  });

  test("extracts the configured input and output fields", () => {
    const { service } = build();
    const snapshot = makeSnapshot({
      input: "hello",
      translated: { en: "hello" },
    });

    expect(service.extractInput(snapshot)).toBe("hello");
    expect(service.extractOutput(snapshot)).toEqual({ en: "hello" });
  });

  test("uses the configured languages when no languages field is set", () => {
    const { service } = build({ languagesFieldName: undefined });

    expect(service.extractLanguages(makeSnapshot({ langs: ["pt"] }))).toEqual(
      defaultLanguages
    );
  });

  test("prefers the document languages field when present", () => {
    const { service } = build();

    expect(service.extractLanguages(makeSnapshot({ langs: ["pt"] }))).toEqual([
      "pt",
    ]);
  });

  test("falls back to the configured languages when the field is absent", () => {
    const { service } = build();

    expect(service.extractLanguages(makeSnapshot({ input: "hello" }))).toEqual(
      defaultLanguages
    );
  });

  test("filters out languages that already have a translation", () => {
    const { service } = build();
    const filter = service.filterLanguagesFn({ en: "hello" });

    expect(defaultLanguages.filter(filter)).toEqual(["es", "de", "fr"]);
    expect(logger.log).toHaveBeenCalledWith(messages.skippingLanguage("en"));
  });

  test("writes translations in a transaction and records success", async () => {
    const { firestore, service } = build();
    const snapshot = makeSnapshot({ input: "hello" });

    await service.updateTranslations(snapshot, testTranslations);

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
    expect(firestore.update).toHaveBeenCalledWith(
      snapshot.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      testTranslations
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.updateDocument(snapshot.ref.path)
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.updateDocumentComplete(snapshot.ref.path)
    );
    expect(events.recordSuccessEvent).toHaveBeenCalledWith({
      subject: snapshot.ref.path,
      data: {
        outputFieldName: defaultEnvironment.OUTPUT_FIELD_NAME,
        translations: testTranslations,
      },
    });
  });
});

describe("createTranslationService", () => {
  test("uses the Google Translate client by default", () => {
    const { firestore } = makeFirestore();
    createTranslationService(makeConfig(), firestore);

    expect(translateClass).toHaveBeenCalledWith({
      projectId: defaultEnvironment.PROJECT_ID,
    });
    expect(genkit).not.toHaveBeenCalled();
  });

  test("uses Genkit when a gemini provider is configured", () => {
    const { firestore } = makeFirestore();
    createTranslationService(
      makeConfig({ provider: "gemini-googleai", googleAiApiKey: "api-key" }),
      firestore
    );

    expect(genkit).toHaveBeenCalledTimes(1);
    expect(translateClass).not.toHaveBeenCalled();
  });
});

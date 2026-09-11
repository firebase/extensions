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
vi.mock("../src/events");

import * as events from "../src/events";
import { messages } from "../src/logs/messages";
import type { TranslationService } from "../src/translate";
import { translateDocument } from "../src/translate/translateDocument";
import { translateSingle } from "../src/translate/translateSingle";
import {
  defaultLanguages,
  makeConfig,
  makeSnapshot,
  testTranslations,
} from "./helpers";
import { logger, resetLoggerMocks } from "./mocks/firebase-functions";

const translateString = vi.fn(
  async (text: string, language: string) =>
    testTranslations[language] ?? `${text}-${language}`
);
const updateTranslations = vi.fn(async () => {});

function makeService(
  overrides: Partial<Record<keyof TranslationService, unknown>> = {}
) {
  return {
    translateString,
    updateTranslations,
    extractInput: vi.fn((snapshot: any) => snapshot.get("input")),
    extractLanguages: vi.fn(() => defaultLanguages),
    ...overrides,
  } as unknown as TranslationService;
}

describe("translateDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLoggerMocks();
  });

  test("routes a string input through translateSingle", async () => {
    const snapshot = makeSnapshot({ input: "hello" });

    await translateDocument(snapshot, makeService(), makeConfig());

    expect(updateTranslations).toHaveBeenCalledWith(snapshot, testTranslations);
  });

  test("routes an object input through translateMultiple", async () => {
    const snapshot = makeSnapshot({ input: { one: "hello" } });

    await translateDocument(
      snapshot,
      makeService({ extractLanguages: vi.fn(() => ["en", "es"]) }),
      makeConfig()
    );

    expect(updateTranslations).toHaveBeenCalledWith(snapshot, {
      one: { en: "hello", es: "hola" },
    });
  });

  test("passes a non-string, non-object input through uncoerced", async () => {
    const snapshot = makeSnapshot({ input: 42 });

    await translateDocument(
      snapshot,
      makeService({ extractLanguages: vi.fn(() => ["en"]) }),
      makeConfig()
    );

    expect(translateString).toHaveBeenCalledWith(42, "en");
  });

  test("logs a non-string input without coercing it", async () => {
    const snapshot = makeSnapshot({ input: 42 });

    await translateDocument(
      snapshot,
      makeService({ extractLanguages: vi.fn(() => ["en"]) }),
      makeConfig()
    );

    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputStringToAllLanguages(42 as never, ["en"])
    );
  });

  test("treats a null input as a single translation, uncoerced", async () => {
    const snapshot = makeSnapshot({ input: null });

    await translateDocument(
      snapshot,
      makeService({ extractLanguages: vi.fn(() => ["en"]) }),
      makeConfig()
    );

    expect(translateString).toHaveBeenCalledWith(null, "en");
  });

  test("exits early when the input field is a translation output path", async () => {
    const snapshot = makeSnapshot({ input: "hello" });

    await translateDocument(
      snapshot,
      makeService(),
      makeConfig({
        inputFieldName: "translated.en",
        outputFieldName: "translated",
      })
    );

    expect(logger.error).toHaveBeenCalledWith(
      messages.inputFieldNameIsOutputPath()
    );
    expect(translateString).not.toHaveBeenCalled();
    expect(updateTranslations).not.toHaveBeenCalled();
  });

  test("uses the per-document language list when resolving the output path", async () => {
    const snapshot = makeSnapshot({ input: "hello", langs: ["pt"] });

    await translateDocument(
      snapshot,
      makeService({ extractLanguages: vi.fn(() => ["pt"]) }),
      makeConfig({
        inputFieldName: "translated.en",
        outputFieldName: "translated",
      })
    );

    // "en" is not in the document's language list, so this is not an output path
    expect(logger.error).not.toHaveBeenCalledWith(
      messages.inputFieldNameIsOutputPath()
    );
    expect(translateString).toHaveBeenCalledWith("hello", "pt");
  });
});

describe("translateSingle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLoggerMocks();
  });

  test("builds a language keyed translation map", async () => {
    const snapshot = makeSnapshot({ input: "hello" });

    await translateSingle("hello", defaultLanguages, snapshot, makeService());

    expect(updateTranslations).toHaveBeenCalledWith(snapshot, testTranslations);
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputStringToAllLanguages("hello", defaultLanguages)
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputToAllLanguagesComplete("hello")
    );
  });

  test("logs, records and rethrows translation errors", async () => {
    const snapshot = makeSnapshot({ input: "hello" });
    const error = new Error("Test Translation API Error");
    translateString.mockRejectedValueOnce(error);

    await expect(
      translateSingle("hello", defaultLanguages, snapshot, makeService())
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      ...messages.translateInputToAllLanguagesError("hello", error)
    );
    expect(events.recordErrorEvent).toHaveBeenCalledWith(error);
    expect(updateTranslations).not.toHaveBeenCalled();
  });

  test("writes an empty map when there are no target languages", async () => {
    const snapshot = makeSnapshot({ input: "hello" });

    await translateSingle("hello", [], snapshot, makeService());

    expect(translateString).not.toHaveBeenCalled();
    expect(updateTranslations).toHaveBeenCalledWith(snapshot, {});
  });
});

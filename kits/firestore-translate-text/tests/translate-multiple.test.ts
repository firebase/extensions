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

import type { TranslationService } from "../src/translate";
import { messages } from "../src/logs/messages";
import { translateMultiple } from "../src/translate/translateMultiple";
import { makeSnapshot } from "./helpers";
import { logger, resetLoggerMocks } from "./mocks/firebase-functions";

/**
 * Parity suite for the extension's
 * `functions/__tests__/unit/translateMultipleBackfill.test.ts`. The kit has no
 * backfill task, so only the `translateMultiple` half of that file applies; the
 * expected payloads are kept byte-for-byte identical.
 */
const languages = ["en", "es", "fr"];

const expectedMockArrayTranslations = {
  "0": {
    en: 'mock translated string "hello" in en',
    es: 'mock translated string "hello" in es',
    fr: 'mock translated string "hello" in fr',
  },
  "1": {
    en: 'mock translated string "how are you?" in en',
    es: 'mock translated string "how are you?" in es',
    fr: 'mock translated string "how are you?" in fr',
  },
};

const expectedMockObjectTranslations = {
  test0: {
    en: 'mock translated string "hello" in en',
    es: 'mock translated string "hello" in es',
    fr: 'mock translated string "hello" in fr',
  },
  test1: {
    en: 'mock translated string "how are you?" in en',
    es: 'mock translated string "how are you?" in es',
    fr: 'mock translated string "how are you?" in fr',
  },
};

const translateString = vi.fn(
  async (text: string, language: string) =>
    `mock translated string "${text}" in ${language}`
);
const updateTranslations = vi.fn(async () => {});

const service = {
  translateString,
  updateTranslations,
} as unknown as TranslationService;

describe("translateMultiple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLoggerMocks();
  });

  test("should handle array input correctly", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });

    await translateMultiple(
      ["hello", "how are you?"] as unknown as Record<string, unknown>,
      languages,
      snapshot,
      service
    );

    expect(updateTranslations).toHaveBeenCalledWith(
      snapshot,
      expectedMockArrayTranslations
    );
  });

  test("should handle object input correctly", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });

    await translateMultiple(
      { test0: "hello", test1: "how are you?" },
      languages,
      snapshot,
      service
    );

    expect(updateTranslations).toHaveBeenCalledWith(
      snapshot,
      expectedMockObjectTranslations
    );
  });

  test("writes null for values that are not strings", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });

    await translateMultiple(
      { text: "hello", count: 3 },
      ["en"],
      snapshot,
      service
    );

    expect(translateString).toHaveBeenCalledTimes(1);
    expect(updateTranslations).toHaveBeenCalledWith(snapshot, {
      text: { en: 'mock translated string "hello" in en' },
      count: { en: null },
    });
  });

  test("writes an empty translation map for an empty input", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });

    await translateMultiple({}, languages, snapshot, service);

    expect(translateString).not.toHaveBeenCalled();
    expect(updateTranslations).toHaveBeenCalledWith(snapshot, {});
  });

  test("logs each input string against the full language list", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });

    await translateMultiple({ test0: "hello" }, languages, snapshot, service);

    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputStringToAllLanguages("hello", languages)
    );
  });

  test("propagates translation failures", async () => {
    const snapshot = makeSnapshot({ foo: "bar" }, { path: "document/path" });
    const error = new Error("Test Translation API Error");
    translateString.mockRejectedValueOnce(error);

    await expect(
      translateMultiple({ test0: "hello" }, languages, snapshot, service)
    ).rejects.toThrow(error);

    expect(updateTranslations).not.toHaveBeenCalled();
  });
});

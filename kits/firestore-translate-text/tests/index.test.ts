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

import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { TranslateConfig } from "../src/export-config";
import { resolveTranslateConfig } from "../src/export-config";
import { defaultEnvironment, makeEvent, makeSnapshot } from "./helpers";

// `firebase-functions` and `firebase-functions/v2` resolve to the same module,
// so the logger and the deploy-time declarations share one mock. The spies are
// hoisted rather than imported from `./mocks` because this suite calls
// `vi.resetModules()` between imports of `../src/index`.
const { logger, requiresAPI, requiresRole } = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));

vi.mock("firebase-functions", () => ({ logger, requiresAPI, requiresRole }));

vi.mock("@google-cloud/translate", () => import("./mocks/translate"));
vi.mock("genkit", () => import("./mocks/genkit"));
vi.mock("@genkit-ai/google-genai", () => import("./mocks/google-genai"));
vi.mock("../src/events");

const configFromEnv = vi.fn<() => TranslateConfig>();
const googleAiApiKey = {
  name: "GOOGLE_AI_API_KEY",
  value: vi.fn(() => "api-key"),
};
const CONFIG_EXPRESSIONS = { document: "translations/{messageId}" };

vi.mock("../src/config", () => ({
  CONFIG_EXPRESSIONS,
  configFromEnv,
  googleAiApiKey,
}));

const onDocumentWritten = vi.fn(
  (options: unknown, handler: (event: unknown) => unknown) => ({
    options,
    handler,
  })
);

vi.mock("firebase-functions/v2/firestore", () => ({ onDocumentWritten }));

const getApp = vi.fn(() => {
  throw new Error("no app");
});
const initializeApp = vi.fn();

vi.mock("firebase-admin/app", () => ({ getApp, initializeApp }));

const firestore = { id: "firestore-instance" };
const getFirestore = vi.fn(() => firestore);

vi.mock("firebase-admin/firestore", () => ({ getFirestore }));

const handleDocumentWrite = vi.fn(async () => {});

vi.mock("../src/handlers", () => ({ handleDocumentWrite }));

import * as events from "../src/events";

const baseConfig: TranslateConfig = {
  collectionPath: defaultEnvironment.COLLECTION_PATH,
  inputFieldName: defaultEnvironment.INPUT_FIELD_NAME,
  outputFieldName: defaultEnvironment.OUTPUT_FIELD_NAME,
  languages: defaultEnvironment.LANGUAGES,
  languagesFieldName: defaultEnvironment.LANGUAGES_FIELD_NAME,
  projectId: defaultEnvironment.PROJECT_ID,
  region: defaultEnvironment.LOCATION,
};

async function importIndex(config: TranslateConfig = baseConfig) {
  configFromEnv.mockReturnValue(config);
  vi.resetModules();
  return import("../src/index");
}

describe("index", () => {
  // Importing `../src/index` pulls in genkit and `@google-cloud/translate`, and
  // every test re-imports it after `vi.resetModules()`. Warm the module graph
  // once here so the first test does not race the default test timeout while
  // paying the cold load cost.
  beforeAll(async () => {
    await importIndex();
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    getApp.mockImplementation(() => {
      throw new Error("no app");
    });
  });

  test("declares the roles the trigger needs", async () => {
    await importIndex();

    expect(requiresRole.mock.calls.flat()).toEqual([
      "roles/datastore.user",
      "roles/eventarc.eventReceiver",
      "roles/run.invoker",
    ]);
  });

  test("declares the Cloud Firestore API requirement", async () => {
    await importIndex();

    expect(requiresAPI).toHaveBeenCalledWith(
      "firestore.googleapis.com",
      "Reads source strings and writes translations back to Cloud Firestore."
    );
  });

  test("declares the Cloud Translation API requirement", async () => {
    await importIndex();

    expect(requiresAPI).toHaveBeenCalledWith(
      "translate.googleapis.com",
      "To use Google Translate to translate strings into the specified target languages."
    );
  });

  test("registers the document trigger against the collection path param", async () => {
    const { fstranslate } = await importIndex();

    expect(onDocumentWritten).toHaveBeenCalledWith(
      { document: CONFIG_EXPRESSIONS.document, secrets: [googleAiApiKey] },
      expect.any(Function)
    );
    expect(fstranslate).toBeDefined();
  });

  test("re-exports the library surface", async () => {
    const index = await importIndex();

    expect(index.resolveTranslateConfig).toBeTypeOf("function");
    expect(index.handleDocumentWrite).toBeTypeOf("function");
  });

  test("does not resolve config or touch Firestore until the first event", async () => {
    await importIndex();

    expect(configFromEnv).not.toHaveBeenCalled();
    expect(getFirestore).not.toHaveBeenCalled();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(events.setupEventChannel).not.toHaveBeenCalled();
  });

  test("builds the handler context on the first event and reuses it", async () => {
    await importIndex();
    const [, handler] = onDocumentWritten.mock.calls[0];
    const event = makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" }));

    await handler(event);
    await handler(event);

    expect(handleDocumentWrite).toHaveBeenNthCalledWith(1, event, {
      config: resolveTranslateConfig(baseConfig),
      service: expect.anything(),
    });
    const contexts = handleDocumentWrite.mock.calls.map(([, ctx]) => ctx);
    expect(contexts[1]).toBe(contexts[0]);
    expect(configFromEnv).toHaveBeenCalledTimes(1);
    expect(getFirestore).toHaveBeenCalledTimes(1);
    expect(events.setupEventChannel).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  test("initializes the default app when one does not exist", async () => {
    await importIndex();
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(initializeApp).toHaveBeenCalledTimes(1);
  });

  test("reuses an already initialized default app", async () => {
    getApp.mockImplementation(() => ({ name: "[DEFAULT]" } as never));
    await importIndex();
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(initializeApp).not.toHaveBeenCalled();
  });

  test("resolves the Google AI API key secret only for gemini providers", async () => {
    await importIndex({ ...baseConfig, provider: "gemini-googleai" });
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(googleAiApiKey.value).toHaveBeenCalledTimes(1);
    expect(handleDocumentWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        config: expect.objectContaining({ googleAiApiKey: "api-key" }),
      })
    );
  });

  test("prefers the secret over the configured Google AI API key", async () => {
    await importIndex({
      ...baseConfig,
      provider: "gemini-googleai",
      googleAiApiKey: "from-config",
    });
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(handleDocumentWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        config: expect.objectContaining({ googleAiApiKey: "api-key" }),
      })
    );
  });

  test("redacts the Google AI API key from the init log", async () => {
    await importIndex({ ...baseConfig, googleAiApiKey: "super-secret" });
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(logger.log).toHaveBeenCalledWith(
      "Initializing extension with the parameter values",
      expect.objectContaining({
        collectionPath: baseConfig.collectionPath,
        googleAiApiKey: "<omitted>",
      })
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("super-secret");
  });

  test("does not read the secret for the Google Translate provider", async () => {
    await importIndex({ ...baseConfig, provider: "translate" });
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));

    expect(googleAiApiKey.value).not.toHaveBeenCalled();
  });
});

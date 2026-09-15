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

vi.mock("firebase-functions", async () => ({
  ...(await import("./mocks/firebase-functions")),
  requiresAPI: vi.fn(),
  requiresRole: vi.fn(),
}));
vi.mock("@google-cloud/translate", () => import("./mocks/translate"));
vi.mock("genkit", () => import("./mocks/genkit"));
vi.mock("@genkit-ai/google-genai", () => import("./mocks/google-genai"));
vi.mock("../src/events");

const { configFromEnv, onDocumentWritten } = vi.hoisted(() => ({
  configFromEnv: vi.fn(),
  onDocumentWritten: vi.fn(
    (_options: unknown, handler: (event: unknown) => Promise<void>) => handler
  ),
}));

vi.mock("../src/config", () => ({
  CONFIG_EXPRESSIONS: { document: "translations/{messageId}" },
  configFromEnv,
  googleAiApiKey: { name: "GOOGLE_AI_API_KEY", value: vi.fn(() => "api-key") },
}));

vi.mock("firebase-functions/v2/firestore", () => ({ onDocumentWritten }));

vi.mock("firebase-admin/app", () => ({
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  initializeApp: vi.fn(),
}));

vi.mock("firebase-admin/firestore", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getFirestore: vi.fn(() => ({
    runTransaction: vi.fn(
      async (handler: (tx: { update: () => void }) => Promise<void>) =>
        handler({ update: vi.fn() })
    ),
  })),
}));

import "../src/index";
import { defaultEnvironment, makeEvent, makeSnapshot } from "./helpers";
import { translateClass } from "./mocks/translate";

/**
 * Unlike `index.test.ts`, this suite keeps `../src/handlers` real so the
 * events flow through the full trigger path against a mocked translation
 * client.
 */
describe("handler context", () => {
  test("constructs the translation client once across invocations", async () => {
    configFromEnv.mockReturnValue({
      collectionPath: defaultEnvironment.COLLECTION_PATH,
      inputFieldName: defaultEnvironment.INPUT_FIELD_NAME,
      outputFieldName: defaultEnvironment.OUTPUT_FIELD_NAME,
      languages: defaultEnvironment.LANGUAGES,
      languagesFieldName: defaultEnvironment.LANGUAGES_FIELD_NAME,
      projectId: defaultEnvironment.PROJECT_ID,
      region: defaultEnvironment.LOCATION,
    });
    const [, handler] = onDocumentWritten.mock.calls[0];

    await handler(makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })));
    await handler(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "goodbye" }))
    );

    expect(translateClass).toHaveBeenCalledTimes(1);
    expect(translateClass).toHaveBeenCalledWith({
      projectId: defaultEnvironment.PROJECT_ID,
    });
  });
});

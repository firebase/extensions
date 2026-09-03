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

import { FieldValue } from "firebase-admin/firestore";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions", () => import("./mocks/firebase-functions"));
vi.mock("@google-cloud/translate", () => import("./mocks/translate"));
vi.mock("genkit", () => import("./mocks/genkit"));
vi.mock("@genkit-ai/google-genai", () => import("./mocks/google-genai"));
vi.mock("../src/events");

import * as events from "../src/events";
import { handleDocumentWrite } from "../src/handlers";
import { messages } from "../src/logs/messages";
import { createTranslationService } from "../src/translate";
import {
  defaultEnvironment,
  defaultLanguages,
  expectedEventContext,
  makeConfig,
  makeEvent,
  makeFirestore,
  makeSnapshot,
  testTranslations,
} from "./helpers";
import { logger, resetLoggerMocks } from "./mocks/firebase-functions";
import { resetGoogleGenaiMocks } from "./mocks/google-genai";
import {
  resetTranslateMocks,
  translateClass,
  translateClassMethod,
} from "./mocks/translate";

/**
 * Parity suite for the extension's `functions/__tests__/functions.test.ts`. The
 * extension wraps the deployed `fstranslate` trigger with
 * `firebase-functions-test`; the kit calls the exported handler directly and
 * injects the Firestore/config dependencies the trigger would otherwise close
 * over.
 */
describe("handleDocumentWrite", () => {
  let firestore: ReturnType<typeof makeFirestore>;

  const context = (overrides: Parameters<typeof makeConfig>[0] = {}) => {
    const config = makeConfig(overrides);
    return {
      config,
      service: createTranslationService(config, firestore.firestore),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetLoggerMocks();
    resetTranslateMocks();
    resetGoogleGenaiMocks();
    firestore = makeFirestore();
  });

  test("initializes the Google Translation API with the project id", async () => {
    await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      context()
    );

    expect(translateClass).toHaveBeenCalledTimes(1);
    expect(translateClass).toHaveBeenCalledWith({
      projectId: defaultEnvironment.PROJECT_ID,
    });
  });

  test("skips events without change data", async () => {
    await expect(
      handleDocumentWrite(makeEvent(undefined, undefined), context())
    ).resolves.toBeUndefined();

    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
    expect(events.recordStartEvent).not.toHaveBeenCalled();
  });

  test("records start and completion events", async () => {
    const event = makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" }));

    await handleDocumentWrite(event, context());

    // The extension published the 1st gen `{change, context}` payload, so the
    // kit rebuilds the same shape rather than exposing the 2nd gen event.
    expect(events.recordStartEvent).toHaveBeenCalledWith({
      change: event.data,
      context: expectedEventContext(),
    });
    expect(events.recordCompletionEvent).toHaveBeenCalledWith({
      context: expectedEventContext(),
    });
  });

  test("skips deleted document change events", async () => {
    const callResult = await handleDocumentWrite(
      makeEvent(
        makeSnapshot({ input: "hello" }),
        makeSnapshot({ input: "hello" }, { exists: false })
      ),
      context()
    );

    expect(callResult).toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(messages.documentDeleted());
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
  });

  test("skips 'update' document change events if the input is unchanged", async () => {
    const callResult = await handleDocumentWrite(
      makeEvent(
        makeSnapshot({ input: "hello" }),
        makeSnapshot({ input: "hello", changed: 123 })
      ),
      context()
    );

    expect(callResult).toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(
      messages.documentUpdatedUnchangedInput()
    );
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
  });

  test("skips 'created' document change events without any input", async () => {
    const callResult = await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ changed: 123 })),
      context()
    );

    expect(callResult).toBeUndefined();
    expect(logger.log).toHaveBeenCalledWith(messages.documentCreatedNoInput());
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
  });

  test("exits early if the input and output fields are the same", async () => {
    const callResult = await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      context({ inputFieldName: "input", outputFieldName: "input" })
    );

    expect(callResult).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      messages.fieldNamesNotDifferent()
    );
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
    expect(events.recordCompletionEvent).toHaveBeenCalledTimes(1);
  });

  test("exits early if the input field is a translation output path", async () => {
    const callResult = await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      context({
        inputFieldName: "translated.en",
        outputFieldName: "translated",
      })
    );

    expect(callResult).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      messages.inputFieldNameIsOutputPath()
    );
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(firestore.update).not.toHaveBeenCalled();
    expect(events.recordCompletionEvent).toHaveBeenCalledTimes(1);
  });

  test("updates the translation document with translations", async () => {
    const after = makeSnapshot({ input: "hello" });

    await handleDocumentWrite(makeEvent(makeSnapshot(), after), context());

    // confirm the Google Translation API was called for every language
    for (const language of defaultLanguages) {
      expect(translateClassMethod).toHaveBeenCalledWith("hello", language);
    }

    // confirm the document update was called
    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      testTranslations
    );

    // confirm logs were printed
    expect(logger.log).toHaveBeenCalledWith(
      messages.documentCreatedWithInput()
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputStringToAllLanguages("hello", defaultLanguages)
    );
    for (const language of defaultLanguages) {
      expect(logger.log).toHaveBeenCalledWith(
        messages.translateStringComplete(
          "hello",
          language,
          testTranslations[language]
        )
      );
    }
    expect(logger.log).toHaveBeenCalledWith(
      messages.translateInputToAllLanguagesComplete("hello")
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.updateDocument(after.ref.path)
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.updateDocumentComplete(after.ref.path)
    );
    expect(logger.log).toHaveBeenCalledWith(messages.complete());
  });

  test("only translates to english when the languages field holds a single item", async () => {
    const after = makeSnapshot({
      input: { one: "hello", two: "hello" },
      langs: ["en"],
    });

    await handleDocumentWrite(
      makeEvent(makeSnapshot({ input: "hello" }), after),
      context()
    );

    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      {
        one: { en: "hello" },
        two: { en: "hello" },
      }
    );
    expect(translateClassMethod).toHaveBeenCalledTimes(2);
  });

  test("only translates english and spanish when the languages field holds both", async () => {
    const after = makeSnapshot({
      input: { one: "hello", two: "hello" },
      langs: ["en", "es"],
    });

    await handleDocumentWrite(
      makeEvent(makeSnapshot({ input: "hello" }), after),
      context()
    );

    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      {
        one: { en: "hello", es: "hola" },
        two: { en: "hello", es: "hola" },
      }
    );
  });

  test("re-translates when only the languages field changes", async () => {
    const after = makeSnapshot({ input: "hello", langs: ["en", "es"] });

    await handleDocumentWrite(
      makeEvent(makeSnapshot({ input: "hello", langs: ["en"] }), after),
      context()
    );

    expect(logger.log).toHaveBeenCalledWith(
      messages.documentUpdatedChangedInput()
    );
    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      { en: "hello", es: "hola" }
    );
  });

  test("updates the translation document when the previous input changes", async () => {
    const after = makeSnapshot({ input: "hello" });

    await handleDocumentWrite(
      makeEvent(makeSnapshot({ input: "goodbye" }), after),
      context()
    );

    expect(logger.log).toHaveBeenCalledWith(
      messages.documentUpdatedChangedInput()
    );
    for (const language of defaultLanguages) {
      expect(translateClassMethod).toHaveBeenCalledWith("hello", language);
    }
    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      testTranslations
    );
  });

  test("deletes translations if the input field is removed", async () => {
    const after = makeSnapshot({}, { exists: true });

    await handleDocumentWrite(
      makeEvent(makeSnapshot({ input: "hello" }), after),
      context()
    );

    expect(firestore.update).toHaveBeenCalledWith(
      after.ref,
      defaultEnvironment.OUTPUT_FIELD_NAME,
      FieldValue.delete()
    );
    expect(logger.log).toHaveBeenCalledWith(
      messages.documentUpdatedDeletedInput()
    );
    expect(translateClassMethod).not.toHaveBeenCalled();
  });

  test("skips processing if there is no input on the before and after snapshots", async () => {
    const snapshot = makeSnapshot({ notTheInput: "hello" });

    await handleDocumentWrite(makeEvent(snapshot, snapshot), context());

    expect(firestore.update).not.toHaveBeenCalled();
    expect(translateClassMethod).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(messages.documentUpdatedNoInput());
  });

  test("handles Google Translation API errors", async () => {
    const error = new Error("Test Translation API Error");
    translateClassMethod.mockRejectedValueOnce(error);

    await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      context()
    );

    expect(logger.error).toHaveBeenCalledWith(
      ...messages.translateStringError("hello", "en", error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      ...messages.translateInputToAllLanguagesError("hello", error)
    );
    expect(logger.error).toHaveBeenCalledWith(...messages.error(error));
    expect(events.recordErrorEvent).toHaveBeenCalledWith(error);
    expect(firestore.update).not.toHaveBeenCalled();
    // the handler still completes so the extension lifecycle event fires
    expect(events.recordCompletionEvent).toHaveBeenCalledWith({
      context: expectedEventContext(),
    });
  });

  test("logs the resolved configuration on every invocation", async () => {
    const ctx = context();

    await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      ctx
    );

    expect(logger.log).toHaveBeenCalledWith(...messages.start(ctx.config));
  });

  test("redacts the Google AI API key from the start log", async () => {
    const ctx = context({ googleAiApiKey: "super-secret" });

    await handleDocumentWrite(
      makeEvent(makeSnapshot(), makeSnapshot({ input: "hello" })),
      ctx
    );

    expect(logger.log).toHaveBeenCalledWith(
      "Started execution of extension with configuration",
      expect.objectContaining({
        collectionPath: ctx.config.collectionPath,
        googleAiApiKey: "<omitted>",
      })
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("super-secret");
  });
});

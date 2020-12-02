import mockedEnv from "mocked-env";
import * as functionsTestInit from "firebase-functions-test";

import { messages } from "../src/logs/messages";

const defaultEnvironment = {
  PROJECT_ID: "fake-project",
  LOCATION: "us-central1",
  // values from extension.yaml param defaults
  LANGUAGES: "en,es,de,fr",
  COLLECTION_PATH: "translations",
  INPUT_FIELD_NAME: "input",
  OUTPUT_FIELD_NAME: "translated",
};

const {
  snapshot,
  testTranslations,
  mockDocumentSnapshotFactory,
  mockTranslate,
  mockTranslateClassMethod,
  mockTranslateClass,
  mockFirestoreUpdate,
  mockFirestoreTransaction,
  mockTranslateModule,
  clearMocks,
} = global;

mockTranslateModule();

let functionsTest = functionsTestInit();
let restoreEnv;

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(defaultEnvironment);
    clearMocks();
  });

  test("functions are exported", () => {
    const exportedFunctions = jest.requireActual("../src");
    expect(exportedFunctions.fstranslate).toBeInstanceOf(Function);
  });

  describe("functions.fstranslate", () => {
    let logMock;
    let errorLogMock;
    let admin;
    let wrappedMockTranslate;
    let beforeSnapshot;
    let afterSnapshot;
    let documentChange;

    beforeEach(() => {
      // this is best thought of as default environment for each test which might be altered within
      // each test subject to test's needs
      jest.resetModules();
      functionsTest = functionsTestInit();
      admin = require("firebase-admin");
      wrappedMockTranslate = mockTranslate();
      logMock = jest.fn();
      errorLogMock = jest.fn();
      beforeSnapshot = snapshot({});

      afterSnapshot = snapshot();

      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        mockDocumentSnapshotFactory(afterSnapshot)
      );
      admin.firestore().runTransaction = mockFirestoreTransaction();

      require("firebase-functions").logger = {
        log: logMock,
        error: errorLogMock,
      };
    });

    test("initializes Google Translation API with PROJECT_ID on function load", () => {
      // need to reset modules
      jest.resetModules();
      // so we can require clean ../function/src that has not been called
      require("../src");

      expect(mockTranslateClass).toHaveBeenCalledTimes(1);
      expect(mockTranslateClass).toHaveBeenCalledWith({
        projectId: defaultEnvironment.PROJECT_ID,
      });
    });

    test("function skips deleted document change events", async () => {
      documentChange.after.exists = false;
      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();
      expect(logMock).toHaveBeenCalledWith(messages.documentDeleted());

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips 'update' document change events if the input is unchanged", async () => {
      beforeSnapshot = snapshot();

      afterSnapshot = snapshot({
        input: "hello",
        changed: 123,
      });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedMockTranslate(documentChange);
      expect(callResult).toBeUndefined();
      expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining(messages.documentUpdatedUnchangedInput())
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips document 'created' document change events without any input", async () => {
      afterSnapshot = snapshot({
        changed: 123,
      });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();

      expect(logMock).toHaveBeenCalledWith(messages.documentCreatedNoInput());

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function exits early if input & output fields are the same", async () => {
      restoreEnv = mockedEnv({
        ...defaultEnvironment,
        INPUT_FIELD_NAME: "input",
        OUTPUT_FIELD_NAME: "input",
      });

      wrappedMockTranslate = mockTranslate();

      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();
    });

    test("function exits early if input field is a translation output path", async () => {
      restoreEnv = mockedEnv({
        ...defaultEnvironment,
        INPUT_FIELD_NAME: "output.en",
        OUTPUT_FIELD_NAME: "output",
      });

      wrappedMockTranslate = mockTranslate();

      const callResult = await wrappedMockTranslate(documentChange);
      expect(callResult).toBeUndefined();
    });

    test("function updates translation document with translations", async () => {
      await wrappedMockTranslate(documentChange);

      // confirm Google Translation API was called
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "en");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "es");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "fr");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "de");

      // confirm document update was called
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        defaultEnvironment.OUTPUT_FIELD_NAME,
        testTranslations
      );

      // confirm logs were printed
      Object.keys(testTranslations).forEach((language) => {
        // logs.translateInputString
        expect(logMock).toHaveBeenCalledWith(
          messages.translateInputString("hello", language)
        );
        // logs.translateStringComplete
        expect(logMock).toHaveBeenCalledWith(
          messages.translateStringComplete("hello", language)
        );
      });

      // logs.translateInputStringToAllLanguages
      expect(logMock).toHaveBeenCalledWith(
        messages.translateInputStringToAllLanguages(
          "hello",
          defaultEnvironment.LANGUAGES.split(",")
        )
      );
      // logs.translateInputToAllLanguagesComplete
      expect(logMock).toHaveBeenCalledWith(
        messages.translateInputToAllLanguagesComplete("hello")
      );
    });

    test("function updates translation document with multiple translations", async () => {
      beforeSnapshot = snapshot();

      afterSnapshot = snapshot({
        input: {
          one: "hello",
          two: "hello",
        },
      });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      await wrappedMockTranslate(documentChange);

      // confirm document update was called
      expect(mockFirestoreUpdate).toHaveBeenCalledWith("translated", {
        one: {
          de: "hallo",
          en: "hello",
          es: "hola",
          fr: "salut",
        },
        two: {
          de: "hallo",
          en: "hello",
          es: "hola",
          fr: "salut",
        },
      });

      // confirm logs were printed
      Object.entries((key, value) => {
        expect(logMock).toHaveBeenCalledWith(
          messages.translateInputString(value, key)
        );

        // logs.translateInputStringToAllLanguages
        expect(logMock).toHaveBeenCalledWith(
          messages.translateInputStringToAllLanguages(
            key,
            defaultEnvironment.LANGUAGES.split(",")
          )
        );

        // logs.translateInputToAllLanguagesComplete
        expect(logMock).toHaveBeenCalledWith(
          messages.translateInputToAllLanguagesComplete(value)
        );
      });
    });

    test("function updates translation document when previous input changes", async () => {
      beforeSnapshot = snapshot({
        input: "goodbye",
      });

      documentChange.before = beforeSnapshot;

      await wrappedMockTranslate(documentChange);

      // logs.documentUpdatedChangedInput
      expect(logMock).toHaveBeenCalledWith(
        messages.documentUpdatedChangedInput()
      );

      // confirm Google Translation API was called
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "en");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "es");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "fr");
      expect(mockTranslateClassMethod).toHaveBeenCalledWith("hello", "de");

      // confirm document update was called
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        defaultEnvironment.OUTPUT_FIELD_NAME,
        testTranslations
      );
    });

    test("function deletes translations if input field is removed", async () => {
      beforeSnapshot = snapshot();

      afterSnapshot = snapshot({});

      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        mockDocumentSnapshotFactory(afterSnapshot)
      );

      await wrappedMockTranslate(documentChange);

      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        defaultEnvironment.OUTPUT_FIELD_NAME,
        admin.firestore.FieldValue.delete()
      );

      // logs.documentUpdatedDeletedInput
      expect(logMock).toHaveBeenCalledWith(
        messages.documentUpdatedDeletedInput()
      );
    });

    test("function skips processing if no input string on before & after snapshots", async () => {
      const snap = snapshot({
        notTheInput: "hello",
      });

      documentChange = functionsTest.makeChange(
        snap,
        mockDocumentSnapshotFactory(snap)
      );

      await wrappedMockTranslate(documentChange);

      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
      expect(mockTranslateClassMethod).not.toHaveBeenCalled();

      // logs.documentUpdatedNoInput
      expect(logMock).toHaveBeenCalledWith(messages.documentUpdatedNoInput());
    });

    test("function handles Google Translation API errors", async () => {
      const error = new Error("Test Translation API Error");
      mockTranslateClassMethod.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await wrappedMockTranslate(documentChange);

      // logs.translateStringError
      expect(errorLogMock).toHaveBeenCalledWith(
        ...messages.translateStringError("hello", "en", error)
      );

      // logs.translateInputToAllLanguagesError
      expect(errorLogMock).toHaveBeenCalledWith(
        ...messages.translateInputToAllLanguagesError("hello", error)
      );
    });
  });
});

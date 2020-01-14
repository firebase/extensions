import mockedEnv from "mocked-env";
import * as functionsTestInit from "firebase-functions-test";

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
  mockConsoleError,
  mockConsoleLog,
  mockFirestoreUpdate,
  mockFirestoreTransaction,
  clearMocks,
} = global;

// import { Translate } from "@google-cloud/translate";
function mockTranslateModuleFactory() {
  return {
    Translate: mockTranslateClass,
  };
}

jest.mock("@google-cloud/translate", mockTranslateModuleFactory);

let restoreEnv;
let functionsTest = functionsTestInit();

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(defaultEnvironment);
    clearMocks();
  });

  test("functions are exported", () => {
    const exportedFunctions = jest.requireActual("../functions/src");
    expect(exportedFunctions.fstranslate).toBeInstanceOf(Function);
  });

  describe("functions.fstranslate", () => {
    let admin;
    let wrappedMockTranslate;
    let beforeSnapshot;
    let afterSnapshot;
    let documentChange;

    beforeEach(() => {
      // this is best thought of as default environment for each test which might be reset subject to test's needs
      jest.resetModules();
      functionsTest = functionsTestInit();
      admin = require("firebase-admin");
      wrappedMockTranslate = mockTranslate();

      beforeSnapshot = snapshot({});

      afterSnapshot = snapshot();

      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        mockDocumentSnapshotFactory(afterSnapshot)
      );
      admin.firestore().runTransaction = mockFirestoreTransaction();
    });

    test("initializes Google Translate API with PROJECT_ID on function load", () => {
      // need to reset modules again so we can require clean ../function/src that has not been called
      jest.resetModules();
      require("../functions/src");

      expect(mockTranslateClass).toHaveBeenCalledTimes(1);
      expect(mockTranslateClass).toHaveBeenCalledWith({
        projectId: defaultEnvironment.PROJECT_ID,
      });
    });

    test("function skips deleted document change events", async () => {
      clearMocks();

      documentChange.after.exists = false;
      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was deleted, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips 'update' document change events if the input is unchanged", async () => {
      clearMocks();

      beforeSnapshot = snapshot();

      afterSnapshot = snapshot({
        input: "hello",
        changed: 123,
      });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedMockTranslate(documentChange);
      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string has not changed, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips document 'created' document change events without any input", async () => {
      clearMocks();

      afterSnapshot = snapshot({
        changed: 123,
      });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was created without an input string, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function exits early if input & output fields are the same", async () => {
      // reset modules again so ENV variables can be reset
      jest.resetModules();

      restoreEnv = mockedEnv({
        ...defaultEnvironment,
        INPUT_FIELD_NAME: "input",
        OUTPUT_FIELD_NAME: "input",
      });

      wrappedMockTranslate = mockTranslate();

      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleError).toHaveBeenCalledWith(
        "The `Input` and `Output` field names must be different for this extension to function correctly"
      );
    });

    test("function exits early if input field is a translation output path", async () => {
      jest.resetModules();

      restoreEnv = mockedEnv({
        ...defaultEnvironment,
        INPUT_FIELD_NAME: "output.en",
        OUTPUT_FIELD_NAME: "output",
      });

      wrappedMockTranslate = mockTranslate();

      const callResult = await wrappedMockTranslate(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleError).toHaveBeenCalledWith(
        "The `Input` field name must not be the same as an `Output` path for this extension to function correctly"
      );
    });

    test("function updates translation document with translations", async () => {
      clearMocks();

      await wrappedMockTranslate(documentChange);

      // confirm Google Translate API was called
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
        expect(mockConsoleLog).toHaveBeenCalledWith(
          `Translating string: 'hello' into language(s): '${language}'`
        );
        // logs.translateStringComplete
        expect(mockConsoleLog).toHaveBeenCalledWith(
          `Finished translating string: 'hello' into language(s): '${language}'`
        );
      });
      // logs.translateInputStringToAllLanguages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `Translating string: 'hello' into language(s): '${
          defaultEnvironment.LANGUAGES
        }'`
      );
      // logs.translateInputToAllLanguagesComplete
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Finished translating string: 'hello'"
      );
    });

    test("function updates translation document when previous input changes", async () => {
      clearMocks();

      beforeSnapshot = snapshot({
        input: "goodbye",
      });

      documentChange.before = beforeSnapshot;

      await wrappedMockTranslate(documentChange);

      // logs.documentUpdatedChangedInput
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string has changed"
      );

      // confirm Google Translate API was called
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
      clearMocks();

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
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string was deleted"
      );
    });

    test("function skips processing if no input string on before & after snapshots", async () => {
      clearMocks();

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
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, no input string exists, no processing is required"
      );
    });

    test("function handles Google Translate API errors", async () => {
      clearMocks();

      const error = new Error("Test Translate API Error");
      mockTranslateClassMethod.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await wrappedMockTranslate(documentChange);

      // logs.translateStringError
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error when translating string: 'hello' into language(s): 'en'",
        error
      );

      // logs.translateInputToAllLanguagesError
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error when translating string: 'hello'",
        error
      );
    });
  });
});

import mockedEnv from "mocked-env";
import * as functionsTestInit from "firebase-functions-test";

const testTranslations = {
  de: "hallo",
  en: "hello",
  es: "hola",
  fr: "salut",
};

const defaultEnvironment = {
  PROJECT_ID: "fake-project",
  LOCATION: "us-central1",
  // values from extension.yaml param defaults
  LANGUAGES: "en,es,de,fr",
  COLLECTION_PATH: "translations",
  INPUT_FIELD_NAME: "input",
  OUTPUT_FIELD_NAME: "translated",
};

const mockFirestoreUpdate = jest.fn();

// await translate.translate('hello', 'de');
const mockTranslateClassMethod = jest
  .fn()
  .mockImplementation((string: string, targetLanguage: string) => {
    return Promise.resolve([testTranslations[targetLanguage]]);
  });

// new Translate(opts);
const mockTranslateClass = jest.fn().mockImplementation(() => {
  return { translate: mockTranslateClassMethod };
});

// import { Translate } from "@google-cloud/translate";
function mockTranslateModuleFactory() {
  return {
    Translate: mockTranslateClass,
  };
}

function mockDocumentSnapshotFactory(documentSnapshot) {
  return jest.fn().mockImplementation(() => {
    return {
      exists: true,
      get: documentSnapshot.get.bind(documentSnapshot),
      ref: {
        path: documentSnapshot.ref.path,
      },
    };
  })();
}

jest.mock("@google-cloud/translate", mockTranslateModuleFactory);

let restoreEnv;
let functionsTest = functionsTestInit();
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(defaultEnvironment);
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => restoreEnv());

  test("functions are exported", () => {
    const exportedFunctions = jest.requireActual("../functions/src");
    expect(exportedFunctions.fstranslate).toBeInstanceOf(Function);
  });

  describe("functions.fstranslate", () => {
    let admin;
    let wrappedFunction;
    let beforeSnapshot;
    let afterSnapshot;
    let documentChange;

    beforeEach(() => {
      jest.resetModules();
      functionsTest = functionsTestInit();
      admin = require("firebase-admin");
      wrappedFunction = functionsTest.wrap(
        require("../functions/src").fstranslate
      );
      
      beforeSnapshot = global.snapshot({});
      
      afterSnapshot = global.snapshot();

      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        mockDocumentSnapshotFactory(afterSnapshot)
      );
      admin.firestore().runTransaction = jest.fn().mockImplementation(() => {
        return (transactionHandler) => {
          transactionHandler({
            update(ref, field, data) {
              mockFirestoreUpdate(field, data);
            },
          });
        };
      })();
    });

    test("initializes Google Translate API with PROJECT_ID on function load", () => {
      jest.resetModules();
      mockTranslateClass.mockClear();

      require("../functions/src");

      expect(mockTranslateClass).toHaveBeenCalledTimes(1);
      expect(mockTranslateClass).toHaveBeenCalledWith({
        projectId: defaultEnvironment.PROJECT_ID,
      });
    });

    test("function skips deleted document change events", async () => {
      mockFirestoreUpdate.mockClear();
      mockTranslateClassMethod.mockClear();

      documentChange.after.exists = false;
      const callResult = await wrappedFunction(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was deleted, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips 'update' document change events if the input is unchanged", async () => {
      mockFirestoreUpdate.mockClear();
      mockTranslateClassMethod.mockClear();
      
      beforeSnapshot = global.snapshot();

      
      afterSnapshot = global.snapshot({ input: "hello", changed: 123 });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedFunction(documentChange);
      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string has not changed, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function skips document 'created' document change events without any input", async () => {
      mockFirestoreUpdate.mockClear();
      mockTranslateClassMethod.mockClear();

      
      afterSnapshot = global.snapshot({ changed: 123 });

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedFunction(documentChange);

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was created without an input string, no processing is required"
      );

      expect(mockTranslateClassMethod).not.toHaveBeenCalled();
      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
    });

    test("function exits early if input & output fields are the same", async () => {
      jest.resetModules();

      restoreEnv = mockedEnv({
        ...defaultEnvironment,
        INPUT_FIELD_NAME: "input",
        OUTPUT_FIELD_NAME: "input",
      });

      wrappedFunction = functionsTest.wrap(
        require("../functions/src").fstranslate
      );

      const callResult = await wrappedFunction(documentChange);

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

      wrappedFunction = functionsTest.wrap(
        require("../functions/src").fstranslate
      );

      const callResult = await wrappedFunction(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleError).toHaveBeenCalledWith(
        "The `Input` field name must not be the same as an `Output` path for this extension to function correctly"
      );
    });

    test("function updates translation document with translations", async () => {
      mockFirestoreUpdate.mockClear();
      mockConsoleLog.mockClear();

      await wrappedFunction(documentChange);

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
      mockFirestoreUpdate.mockClear();
      mockConsoleLog.mockClear();

      
      beforeSnapshot = global.snapshot({ input: "goodbye" });

      documentChange.before = beforeSnapshot;

      await wrappedFunction(documentChange);

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
      mockFirestoreUpdate.mockClear();
      mockConsoleLog.mockClear();

      
      beforeSnapshot = global.snapshot();
      
      afterSnapshot = global.snapshot({});

      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        mockDocumentSnapshotFactory(afterSnapshot)
      );

      await wrappedFunction(documentChange);

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
      mockFirestoreUpdate.mockClear();
      mockTranslateClassMethod.mockClear();
      mockConsoleLog.mockClear();

      
      const snap = global.snapshot({ notTheInput: "hello" });
      
      documentChange = functionsTest.makeChange(
        snap,
        mockDocumentSnapshotFactory(snap)
      );

      await wrappedFunction(documentChange);

      expect(mockFirestoreUpdate).not.toHaveBeenCalled();
      expect(mockTranslateClassMethod).not.toHaveBeenCalled();

      // logs.documentUpdatedNoInput
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, no input string exists, no processing is required"
      );
    });

    test("function handles Google Translate API errors", async () => {
      mockFirestoreUpdate.mockClear();
      mockConsoleLog.mockClear();

      const error = new Error("Test Translate API Error");
      mockTranslateClassMethod.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      await wrappedFunction(documentChange);

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

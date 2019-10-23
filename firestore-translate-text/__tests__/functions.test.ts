import mockedEnv from "mocked-env";
import * as functionsTestInit from "firebase-functions-test";

const testTranslations = {
  de: "hallo",
  en: "hello",
  es: "hola",
  fr: "salut",
};

const defaultEnvironment = {
  PROJECT_ID: "extensions-testing",
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
const mockTranslateClass = jest.fn().mockImplementation((...args) => {
  return { translate: mockTranslateClassMethod };
});

// import { Translate } from "@google-cloud/translate";
function mockTranslateModuleFactory() {
  return {
    Translate: mockTranslateClass,
  };
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
    let wrappedFunction;
    let beforeSnapshot;
    let afterSnapshot;
    let documentChange;

    beforeEach(() => {
      jest.resetModules();
      functionsTest = functionsTestInit();
      wrappedFunction = functionsTest.wrap(
        require("../functions/src").fstranslate
      );
      beforeSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        {},
        "translations/id1"
      );
      afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { input: "hello" },
        "translations/id1"
      );
      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        jest.fn().mockImplementation(() => {
          return {
            exists: true,
            get: afterSnapshot.get.bind(afterSnapshot),
            ref: {
              path: afterSnapshot.ref.path,
              update: mockFirestoreUpdate,
            },
          };
        })()
      );
    });

    test("initializes Google Translate API on start", () => {
      jest.resetModules();
      mockTranslateClass.mockClear();

      require("../functions/src");

      expect(mockTranslateClass).toHaveBeenCalledTimes(1);
      expect(mockTranslateClass).toBeCalledWith({
        projectId: defaultEnvironment.PROJECT_ID,
      });
    });

    test("function skips deleted document change events", async () => {
      documentChange.after.exists = false;
      const callResult = await wrappedFunction(documentChange);

      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was deleted, no processing is required"
      );
    });

    test("function skips 'update' document change events if the input is unchanged", async () => {
      beforeSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { input: "hello" },
        "translations/id1"
      );

      afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { input: "hello", changed: 123 },
        "translations/id1"
      );

      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedFunction(documentChange);
      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string has not changed, no processing is required"
      );
    });

    test("function skips document 'update' document change events without any input", async () => {
      beforeSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { changed: 123 },
        "translations/id1"
      );
      afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { changed: 123 },
        "translations/id1"
      );
      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedFunction(documentChange);
      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was updated, input string has not changed, no processing is required"
      );
    });

    test("function skips document 'created' document change events without any input", async () => {
      afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { changed: 123 },
        "translations/id1"
      );
      documentChange = functionsTest.makeChange(beforeSnapshot, afterSnapshot);

      const callResult = await wrappedFunction(documentChange);
      expect(callResult).toBeUndefined();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "Document was created without an input string, no processing is required"
      );
    });

    test("function exits early if input & output fields are the same", async () => {
      jest.resetModules();

      restoreEnv();
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

      restoreEnv();
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
      expect(mockFirestoreUpdate).toBeCalledWith(
        defaultEnvironment.OUTPUT_FIELD_NAME,
        testTranslations
      );

      // confirm logs were printed
      Object.keys(testTranslations).forEach((language) => {
        expect(mockConsoleLog).toBeCalledWith(
          `Translating string: 'hello' into language(s): '${language}'`
        );
        expect(mockConsoleLog).toBeCalledWith(
          `Finished translating string: 'hello' into language(s): '${language}'`
        );
      });
      expect(mockConsoleLog).toBeCalledWith(
        `Translating string: 'hello' into language(s): '${
          defaultEnvironment.LANGUAGES
        }'`
      );
      expect(mockConsoleLog).toBeCalledWith(
        "Finished translating string: 'hello'"
      );
    });
  });
});

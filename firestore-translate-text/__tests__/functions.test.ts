import mockedEnv from "mocked-env";
import * as functionsTestInit from "firebase-functions-test";
const { Translate } = require("@google-cloud/translate");

const testTranslations = {
  en: "hello",
  es: "hola",
  de: "hallo",
  fr: "salut",
};

const translateMock = jest
  .fn()
  .mockImplementation((string: string, targetLanguage: string) => {
    return Promise.resolve([testTranslations[targetLanguage]]);
  });

jest.mock("@google-cloud/translate", () => {
  return {
    Translate: jest.fn().mockImplementation(() => {
      return { translate: translateMock };
    }),
  };
});

let restoreEnv;
let functionsTest = functionsTestInit();
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
const environment = {
  PROJECT_ID: "extensions-testing",
  LOCATION: "us-central1",
  // values from extension.yaml param defaults
  LANGUAGES: "en,es,de,fr",
  COLLECTION_PATH: "translations",
  INPUT_FIELD_NAME: "input",
  OUTPUT_FIELD_NAME: "translated",
};

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(environment);
    consoleLogSpy.mockClear();
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
    let firestoreUpdateMock = jest.fn();

    beforeEach(() => {
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
      const afterSnapshotMock = jest.fn().mockImplementation(() => {
        return {
          exists: true,
          get: afterSnapshot.get.bind(afterSnapshot),
          ref: {
            path: afterSnapshot.ref.path,
            update: firestoreUpdateMock,
          },
        };
      })();
      documentChange = functionsTest.makeChange(
        beforeSnapshot,
        afterSnapshotMock
      );
    });

    test("initializes Google Translate API on start", () => {
      jest.requireActual("../functions/src");
      expect(Translate).toHaveBeenCalledTimes(1);
      expect(Translate).toBeCalledWith({ projectId: environment.PROJECT_ID });
    });

    test("function logs and exits early if input & output fields are the same", async () => {
      functionsTest = functionsTestInit();
      wrappedFunction = functionsTest.wrap(
        require("../functions/src").fstranslate
      );
      await wrappedFunction(documentChange);
    });
  });
});

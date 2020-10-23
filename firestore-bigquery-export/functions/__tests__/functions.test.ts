import * as functionsTestInit from "../node_modules/firebase-functions-test";
import mockedEnv from "../node_modules/mocked-env";

import { mockConsoleLog } from "./__mocks__/console";

import config from "../src/config";

jest.mock("@firebaseextensions/firestore-bigquery-change-tracker", () => ({
  FirestoreBigQueryEventHistoryTracker: jest.fn(() => {
    return {
      record: jest.fn(() => {}),
    };
  }),
  ChangeType: {
    DELETE: 2,
    UPDATE: 1,
    CREATE: 0,
  },
}));

jest.mock("../src/logs", () => ({
  start: jest.fn(() =>
    console.log("Started execution of extension with configuration", config)
  ),
  init: jest.fn(() => {}),
  error: jest.fn(() => {}),
  complete: jest.fn(() => console.log("Completed execution of extension")),
}));

const defaultEnvironment = {
  PROJECT_ID: "fake-project",
  DATASET_ID: "my_ds_id",
  TABLE_ID: "my_id",
  COLLECTION_PATH: "example",
};

export const mockExport = (document, data) => {
  const ref = require("../src/index").fsexportbigquery;
  let functionsTest = functionsTestInit();

  const wrapped = functionsTest.wrap(ref);
  return wrapped(document, data);
};

export const mockedFirestoreBigQueryEventHistoryTracker = () => {};

let restoreEnv;
let functionsTest = functionsTestInit();

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(defaultEnvironment);
  });

  test("functions are exported", () => {
    const exportedFunctions = jest.requireActual("../src");
    expect(exportedFunctions.fsexportbigquery).toBeInstanceOf(Function);
  });

  describe("functions.fsexportbigquery", () => {
    let functionsConfig;
    let callResult;

    beforeEach(async () => {
      jest.resetModules();
      functionsTest = functionsTestInit();

      functionsConfig = config;
    });

    test("functions runs with a deletion", async () => {
      const beforeSnapshot = { foo: "bar" };
      const afterSnapshot = { foo: "bars" };

      const documentChange = functionsTest.makeChange(
        beforeSnapshot,
        afterSnapshot
      );

      const callResult = await mockExport(documentChange, {
        resource: {
          name: "test",
        },
      });

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toBeCalledWith(
        "Started execution of extension with configuration",
        functionsConfig
      );

      expect(mockConsoleLog).toBeCalledWith("Completed execution of extension");
    });

    test("function runs with updated data", async () => {
      const beforeSnapshot = { foo: "bar" };
      const afterSnapshot = { foo: "bars", exists: true };

      const documentChange = functionsTest.makeChange(
        beforeSnapshot,
        afterSnapshot
      );

      const callResult = await mockExport(documentChange, {
        resource: {
          name: "test",
        },
      });

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toBeCalledWith(
        "Started execution of extension with configuration",
        functionsConfig
      );

      expect(mockConsoleLog).toBeCalledWith("Completed execution of extension");
    });
  });
});

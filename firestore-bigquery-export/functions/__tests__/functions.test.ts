import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import * as functionsTestInit from "../node_modules/firebase-functions-test";
import mockedEnv from "../node_modules/mocked-env";
import config from "../src/config";
import { mockConsoleLog } from "./__mocks__/console";

// Mock Firestore BigQuery Tracker
jest.mock("@firebaseextensions/firestore-bigquery-change-tracker", () => ({
  FirestoreBigQueryEventHistoryTracker: jest.fn(() => ({
    record: jest.fn(() => {}),
    serializeData: jest.fn(() => {}),
  })),
  ChangeType: {
    DELETE: 2,
    UPDATE: 1,
    CREATE: 0,
  },
}));

jest.mock("firebase-admin/functions", () => ({
  getFunctions: jest.fn(() => ({
    taskQueue: jest.fn(() => ({
      enqueue: jest.fn(),
    })),
  })),
}));

// Mock firebase-admin eventarc
const channelMock = { publish: jest.fn() };
jest.mock("firebase-admin/eventarc", () => ({
  getEventarc: jest.fn(() => ({
    channel: jest.fn(() => channelMock),
  })),
}));

// Mock Logs
jest.mock("../src/logs", () => ({
  ...jest.requireActual("../src/logs"),
  start: jest.fn(() =>
    logger.log("Started execution of extension with configuration", config)
  ),
  complete: jest.fn(() => logger.log("Completed execution of extension")),
}));

// Mock Console
console.info = jest.fn(); // Mock console.info globally

// Environment Variables
const defaultEnvironment = {
  PROJECT_ID: "fake-project",
  DATASET_ID: "my_ds_id",
  TABLE_ID: "my_id",
  COLLECTION_PATH: "example",
  EVENTARC_CHANNEL: "test-channel", // Mock Eventarc Channel
  EXT_SELECTED_EVENTS: "onStart,onSuccess,onError,onCompletion", // Allowed event types
};

let restoreEnv;
let functionsTest;

/** Helper to Mock Export */
const mockExport = (document, data) => {
  const ref = require("../src/index").fsexportbigquery;
  const wrapped = functionsTest.wrap(ref);
  return wrapped(document, data);
};

describe("extension", () => {
  beforeEach(() => {
    restoreEnv = mockedEnv(defaultEnvironment);
    jest.resetModules();
    functionsTest = functionsTestInit();
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
  });

  test("functions are exported", () => {
    const exportedFunctions: any = jest.requireActual("../src");
    expect(exportedFunctions.fsexportbigquery).toBeInstanceOf(Function);
  });

  describe("functions.fsexportbigquery", () => {
    let functionsConfig;

    beforeEach(() => {
      functionsConfig = config;
    });

    test("function runs with a CREATE event", async () => {
      const beforeSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        {}, // Empty to simulate no document
        "example/doc1"
      );
      const afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { foo: "bar" },
        "example/doc1"
      );

      const documentChange = functionsTest.makeChange(
        beforeSnapshot,
        afterSnapshot
      );

      const callResult = await mockExport(documentChange, {
        resource: { name: "example/doc1" },
      });

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toBeCalledWith(
        "Started execution of extension with configuration",
        expect.objectContaining({
          backupBucketName: expect.any(String),
          initialized: expect.any(Boolean),
          maxDispatchesPerSecond: expect.any(Number),
          maxEnqueueAttempts: expect.any(Number),
        })
      );

      expect(mockConsoleLog).toBeCalledWith("Completed execution of extension");
    });

    test("function runs with a DELETE event", async () => {
      const beforeSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        { foo: "bar" },
        "example/doc1"
      );
      const afterSnapshot = functionsTest.firestore.makeDocumentSnapshot(
        {}, // Empty to simulate document deletion
        "example/doc1"
      );

      const documentChange = functionsTest.makeChange(
        beforeSnapshot,
        afterSnapshot
      );

      const callResult = await mockExport(documentChange, {
        resource: { name: "example/doc1" },
      });

      expect(callResult).toBeUndefined();

      expect(mockConsoleLog).toBeCalledWith(
        "Started execution of extension with configuration",
        expect.objectContaining({
          backupBucketName: expect.any(String),
          initialized: expect.any(Boolean),
          maxDispatchesPerSecond: expect.any(Number),
          maxEnqueueAttempts: expect.any(Number),
        })
      );

      expect(mockConsoleLog).toBeCalledWith("Completed execution of extension");
    });
  });
});

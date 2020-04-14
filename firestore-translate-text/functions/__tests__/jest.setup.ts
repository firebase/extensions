import {
  snapshot,
  mockDocumentSnapshotFactory,
  mockFirestoreUpdate,
  mockFirestoreTransaction,
} from "./mocks/firestore";
import { mockConsoleError, mockConsoleLog } from "./mocks/console";
import {
  testTranslations,
  mockTranslate,
  mockTranslateClassMethod,
  mockTranslateClass,
  mockTranslateModuleFactory,
} from "./mocks/translate";

global.config = () => require("../src/config").default;

global.snapshot = snapshot;

global.testTranslations = testTranslations;

global.mockDocumentSnapshotFactory = mockDocumentSnapshotFactory;

global.mockTranslate = mockTranslate;

global.mockTranslateClassMethod = mockTranslateClassMethod;

global.mockTranslateClass = mockTranslateClass;

global.mockTranslateModule = () =>
  jest.mock("@google-cloud/translate", mockTranslateModuleFactory);

global.mockConsoleError = mockConsoleError;

global.mockConsoleLog = mockConsoleLog;

global.mockFirestoreUpdate = mockFirestoreUpdate;

global.mockFirestoreTransaction = mockFirestoreTransaction;

global.clearMocks = () => {
  mockFirestoreUpdate.mockClear();
  mockTranslateClassMethod.mockClear();
  mockConsoleLog.mockClear();
  mockConsoleError.mockClear();
};

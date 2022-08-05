import {
  snapshot,
  mockDocumentSnapshotFactory,
  mockFirestoreUpdate,
  mockFirestoreTransaction,
} from "./mocks/firestore";
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

global.mockFirestoreUpdate = mockFirestoreUpdate;

global.mockFirestoreTransaction = mockFirestoreTransaction;

global.clearMocks = () => {
  mockFirestoreUpdate.mockClear();
  mockTranslateClassMethod.mockClear();
};

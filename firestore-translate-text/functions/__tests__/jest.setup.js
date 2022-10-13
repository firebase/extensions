"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestore_1 = require("./mocks/firestore");
const translate_1 = require("./mocks/translate");
global.config = () => require("../src/config").default;
global.snapshot = firestore_1.snapshot;
global.testTranslations = translate_1.testTranslations;
global.mockDocumentSnapshotFactory = firestore_1.mockDocumentSnapshotFactory;
global.mockTranslate = translate_1.mockTranslate;
global.mockTranslateClassMethod = translate_1.mockTranslateClassMethod;
global.mockTranslateClass = translate_1.mockTranslateClass;
global.mockTranslateModule = () => jest.mock("@google-cloud/translate", translate_1.mockTranslateModuleFactory);
global.mockFirestoreUpdate = firestore_1.mockFirestoreUpdate;
global.mockFirestoreTransaction = firestore_1.mockFirestoreTransaction;
global.clearMocks = () => {
    firestore_1.mockFirestoreUpdate.mockClear();
    translate_1.mockTranslateClassMethod.mockClear();
};

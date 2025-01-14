import * as functionsTestInit from "firebase-functions-test";
import * as admin from "firebase-admin";
import {
  DocumentSnapshot,
  BulkWriter,
  WriteResult,
} from "firebase-admin/firestore";
import { jest } from "@jest/globals";

// Mock DocumentSnapshot
export const mockDocumentSnapshot = (data: object): DocumentSnapshot => {
  return {
    data: () => data,
    exists: true,
    id: "mockId",
    ref: {
      path: "mockPath",
      update: jest.fn(),
    } as any,
    get: jest.fn((field: string) => (data as any)[field]),
  } as unknown as DocumentSnapshot;
};

// Mock BulkWriter
// Define a local BulkWriterError type matching the Firestore definition
type BulkWriterError = {
  code: number;
  documentRef: admin.firestore.DocumentReference;
  operationType: "create" | "set" | "update" | "delete"; // Match Firestore enum types
  failedAttempts: number;
  message: string;
  name: string;
};

export const mockBulkWriter = (): admin.firestore.BulkWriter => ({
  create: jest.fn(() => Promise.resolve({} as admin.firestore.WriteResult)),
  delete: jest.fn(() => Promise.resolve({} as admin.firestore.WriteResult)),
  set: jest.fn(() => Promise.resolve({} as admin.firestore.WriteResult)),
  update: jest.fn(() => Promise.resolve({} as admin.firestore.WriteResult)),
  onWriteResult: jest.fn(),
  onWriteError: jest.fn((callback: (error: BulkWriterError) => boolean) => {
    const mockError: BulkWriterError = {
      code: 4, // Example error code
      documentRef: { path: "mockPath" } as admin.firestore.DocumentReference,
      operationType: "update",
      failedAttempts: 1,
      message: "Mock error message",
      name: "BulkWriterError",
    };
    callback(mockError); // Call the callback with the mock error
  }),
  flush: jest.fn(() => Promise.resolve()),
  close: jest.fn(() => Promise.resolve()),
});

// Mock Firestore Change
export const mockFirestoreChange = (beforeData: object, afterData: object) => ({
  before: mockDocumentSnapshot(beforeData),
  after: mockDocumentSnapshot(afterData),
});

// Mock Context
export const mockContext = () => ({
  eventId: "mockEventId",
  timestamp: new Date().toISOString(),
});

// Mock Project ID
export const mockProjectId = "mock-project-id";
process.env.PROJECT_ID = mockProjectId;

export const snapshot = (
  input = { input: "hello" },
  path = "translations/id1"
) => {
  let functionsTest = functionsTestInit();
  return functionsTest.firestore.makeDocumentSnapshot(input, path);
};

export const mockDocumentSnapshotFactory = (documentSnapshot) => {
  return jest.fn().mockImplementation(() => {
    return {
      exists: true,
      get: documentSnapshot.get.bind(documentSnapshot),
      ref: { path: documentSnapshot.ref.path },
    };
  })();
};

export const makeChange = (before, after) => {
  let functionsTest = functionsTestInit();
  return functionsTest.makeChange(before, after);
};

export const mockFirestoreTransaction = jest.fn().mockImplementation(() => {
  return (transactionHandler) => {
    transactionHandler({
      update(ref, field, data) {
        mockFirestoreUpdate(field, data);
      },
    });
  };
});

export const mockFirestoreUpdate = jest.fn();

// Mock the translateText function
jest.mock("@google-cloud/translate", () => {
  return {
    v3: {
      TranslationServiceClient: jest.fn(() => ({
        translateText: mockTranslate,
      })),
    },
  };
});

export const mockTranslate = jest.fn(async (request: any) => {
  if (
    request.glossaryConfig &&
    request.glossaryConfig.glossary ===
      "projects/test-project/locations/global/glossaries/non_existent_glossary"
  ) {
    throw new Error("Glossary not found");
  }
  return {
    translations: request.contents?.map((content) => ({
      translatedText: `Mock translation of "${content}"`,
    })),
  };
});

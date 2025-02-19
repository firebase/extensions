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

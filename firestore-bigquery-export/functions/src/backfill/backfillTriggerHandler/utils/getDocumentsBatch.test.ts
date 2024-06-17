import config from "../../../config";

jest.mock("../../config", () => ({
  default: {
    backfillOptions: {
      collectionPath: "users",
      batchSize: 10,
    },
  },
}));
const { mockGoogleCloudFirestore } = require("firestore-jest-mock");

mockGoogleCloudFirestore({
  database: {
    [config.backfillOptions.collectionPath!]: [
      { id: "abc123", name: "Homer Simpson" },
      { id: "abc456", name: "Lisa Simpson" },
    ],
    posts: [{ id: "123abc", title: "Really cool title" }],
  },
});

import {
  mockCollection,
  mockGet,
  mockOrderBy,
  mockLimit,
} from "firestore-jest-mock/mocks/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

import { getDocumentsBatch } from "./getDocumentsBatch";

describe("getDocumentsBatch", () => {
  test("getDocumentsBatch returns batch of documents without lastDoc", async () => {
    const result = await getDocumentsBatch(null);
    expect(mockCollection).toHaveBeenCalledWith(
      config.backfillOptions.collectionPath
    );
    expect(mockOrderBy).toHaveBeenCalledWith("__name__");
    expect(mockLimit).toHaveBeenCalledWith(config.backfillOptions.batchSize);
    expect(mockGet).toHaveBeenCalled();

    expect(result.snapshot.docs.length).toBeGreaterThan(0);
    expect(result.newLastDoc).not.toBeNull();
  });

  test("getDocumentsBatch returns batch of documents with lastDoc", async () => {
    const mockLastDoc = { id: "abc123" };

    const result = await getDocumentsBatch(
      mockLastDoc as FirebaseFirestore.QueryDocumentSnapshot
    );
    expect(mockCollection).toHaveBeenCalledWith(
      config.backfillOptions.collectionPath
    );
    expect(mockOrderBy).toHaveBeenCalledWith("__name__");
    expect(mockLimit).toHaveBeenCalledWith(config.backfillOptions.batchSize);
    expect(mockGet).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalled();

    expect(result.snapshot.docs.length).toBeGreaterThan(0);
    expect(result.newLastDoc).not.toBeNull();
  });
});

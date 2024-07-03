jest.mock("../../config", () => ({
  default: {
    backfillOptions: {
      collectionPath: "users",
      batchSize: 10,
    },
  },
}));

jest.mock("../../event_tracker", () => ({
  eventTracker: {
    serializeData: jest.fn((data) => data),
    record: jest.fn(() => Promise.resolve()),
  },
}));

const { mockGoogleCloudFirestore } = require("firestore-jest-mock");

mockGoogleCloudFirestore({
  database: {
    collection1: [
      { id: "doc1", field: "value1" },
      { id: "doc2", field: "value2" },
    ],
    collection2: [{ id: "doc3", field: "value3" }],
  },
});

import { mockDoc, mockGetAll } from "firestore-jest-mock/mocks/firestore";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();

import { backfillTaskHandler } from "./index";
import { eventTracker } from "../../event_tracker";

test("backfillTaskHandler processes tasks and records events", async () => {
  const task = {
    paths: ["collection1/doc1", "collection1/doc2", "collection2/doc3"],
  };
  const mockCtx = {} as functions.tasks.TaskContext;

  await backfillTaskHandler(task, mockCtx);

  expect(mockDoc).toHaveBeenCalledWith("collection1/doc1");
  expect(mockDoc).toHaveBeenCalledWith("collection1/doc2");
  expect(mockDoc).toHaveBeenCalledWith("collection2/doc3");
  expect(mockGetAll).toHaveBeenCalled();

  expect(eventTracker.record).toHaveBeenCalled();
  // You can add more detailed checks depending on your mock implementation
});

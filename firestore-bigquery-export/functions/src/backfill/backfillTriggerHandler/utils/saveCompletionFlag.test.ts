const { mockGoogleCloudFirestore } = require("firestore-jest-mock");
mockGoogleCloudFirestore({
  database: {
    _meta: [{ id: "backfill", completed: false }],
  },
});

import { mockDoc, mockSet } from "firestore-jest-mock/mocks/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
import { saveCompletionFlag } from "./saveCompletionFlag";

test("saveCompletionFlag sets the completion flag to true", async () => {
  await saveCompletionFlag();

  expect(mockDoc).toHaveBeenCalledWith("_meta/backfill");
  expect(mockSet).toHaveBeenCalledWith({ completed: true });
});

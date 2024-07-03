import { mockGoogleCloudFirestore } from "firestore-jest-mock";

mockGoogleCloudFirestore({
  database: {
    users: [
      { id: "abc123", name: "Homer Simpson" },
      { id: "abc456", name: "Lisa Simpson" },
    ],
    posts: [{ id: "123abc", title: "Really cool title" }],
  },
});

import { mockDoc } from "firestore-jest-mock/mocks/firestore";

import * as admin from "firebase-admin";

admin.initializeApp();

import { getLastDoc } from "./getLastDoc";

describe("getLastDoc", () => {
  test("getLastDoc returns null if lastDocPath is null", async () => {
    const result = await getLastDoc(null);
    expect(result).toBeNull();
  });

  test("getLastDoc returns document snapshot if document exists", async () => {
    const result = await getLastDoc("users/abc123");
    expect(mockDoc).toHaveBeenCalledWith("users/abc123");
    expect(result).not.toBeNull();
    expect(result!.data().name).toEqual("Homer Simpson");
  });

  test("getLastDoc returns null if document does not exist", async () => {
    mockDoc.mockReturnValueOnce({
      exists: false,
      data: () => null,
    });

    const result = await getLastDoc("users/nonexistent");
    expect(mockDoc).toHaveBeenCalledWith("users/nonexistent");
    expect(result).toBeNull();
  });
});

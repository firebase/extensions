const { mockGoogleCloudFirestore } = require("firestore-jest-mock");

mockGoogleCloudFirestore({
  database: {
    users: [
      { id: "abc123", name: "Homer Simpson" },
      { id: "abc456", name: "Lisa Simpson" },
    ],
    posts: [{ id: "123abc", title: "Really cool title" }],
  },
});

import { mockCollection } from "firestore-jest-mock/mocks/firestore";
import { Firestore } from "@google-cloud/firestore";

test("testing stuff", () => {
  const firestore = new Firestore();

  return firestore
    .collection("users")
    .get()
    .then((userDocs) => {
      expect(mockCollection).toHaveBeenCalledWith("users");
      expect(userDocs.docs[0].data().name).toEqual("Homer Simpson");
    });
});

import * as admin from "firebase-admin";
import { UserRecord } from "firebase-functions/v1/auth";
import { createFirebaseUser, waitForDocumentDeletion } from "./helpers";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

setupEnvironment();

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

describe("search", () => {
  let user: UserRecord;

  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  test("can delete a single document", async () => {
    await admin
      .firestore()
      .collection("searchFunction")
      .doc("testing")
      .collection("functions-testing")
      .doc("example")
      .set({ functions: "testing" });

    const doc = db.doc("functions/functions-testing");

    await auth.deleteUser(user.uid);

    await waitForDocumentDeletion(doc);
  }, 12000);
});

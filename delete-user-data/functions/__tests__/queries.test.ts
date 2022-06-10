import { DocumentReference } from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { buildQuery } from "../src/buildQuery";

const generateRandomEmail = () => {
  var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  var string = "";
  for (var ii = 0; ii < 15; ii++) {
    string += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${string}@google.com`;
};

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const environment = {
  queryCollection: "queries",
};

admin.initializeApp({ projectId: "demo-test" });
const db = admin.firestore();
const auth = admin.auth();
let user: UserRecord;
let userDoc: DocumentReference;

describe("buildQueries", () => {
  beforeEach(async () => {
    user = await auth.createUser({ email: generateRandomEmail() });

    await Promise.all([
      db
        .collection(environment.queryCollection)
        .doc("users")
        .set({
          collection: "users",
          conditions: [{ where: ["id", "==", "{uid}"] }],
          recursive: true,
        }),
      db
        .collection(environment.queryCollection)
        .doc("{uid}")
        .set({
          collection: "{uid}",
        }),
    ]);
  });

  test("Can delete a single document based on a userId", async () => {
    const userDoc = await db.collection("users").add({ id: user.uid });
    const queries = await buildQuery(user.uid);

    //Assert if document has been deleted.
    return new Promise((resolve) => {
      userDoc.onSnapshot((doc) => {
        if (!doc.exists) resolve(true);
      });
    });
  });

  test("Can delete multiple documents based on a userId", async () => {
    await Promise.all([
      db.collection("users").add({ id: user.uid }),
      db.collection("users").add({ id: user.uid }),
    ]);

    const queries = await buildQuery(user.uid);

    //Assert if document has been deleted.
    return new Promise((resolve) => {
      db.collection("users").onSnapshot((collection) => {
        if (collection.docs.length === 0) resolve(true);
      });
    });
  });

  test("Can delete a collection based on a userId", async () => {
    await Promise.all([db.collection(user.uid).add({ id: "testing" })]);

    const queries = await buildQuery(user.uid);

    //Assert if document has been deleted.
    return new Promise((resolve) => {
      db.collection(user.uid).onSnapshot((collection) => {
        if (collection.docs.length === 0) resolve(true);
      });
    });
  });

  test("Can delete all subcollections based on a userId", async () => {
    const doc = await db.collection("users").add({ id: "testing" });
    const subcollection = doc.collection(user.uid);
    await subcollection.add({ foo: "bar" });

    const queries = await buildQuery(user.uid);

    //Assert if document has been deleted.
    return new Promise((resolve) => {
      subcollection.onSnapshot((collection) => {
        if (collection.docs.length === 0) resolve(true);
      });
    });
  });
});

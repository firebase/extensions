import * as admin from "firebase-admin";
import { firestore } from "firebase-admin";
import { UserRecord } from "firebase-functions/v1/auth";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = admin.initializeApp({
  projectId: "demo-project",
});

const db = app.firestore();
const auth = app.auth();
let user: UserRecord = null;

const usersCollection = db.collection("users");
const postsCollection = db.collection("docs");
describe("delete user data", () => {
  beforeEach(async () => {
    user = await auth.createUser({
      email: `${(Math.random() + 1).toString(36).substring(7)}@example.com`,
    });

    await usersCollection.doc(user.uid);
  });
  it("should remove user collection data", async () => {
    const userDoc = await usersCollection.doc(user.uid);
    const postDoc = await postsCollection.doc(
      (Math.random() + 1).toString(36).substring(7)
    );
    await usersCollection.doc(userDoc.id).create({ foo: "bar" });
    await postsCollection.doc(postDoc.id).create({ uid: user.uid });

    await auth.deleteUser(user.uid);

    //   return new Promise((resolve) => {
    //     const unsubscribe = userDoc.onSnapshot(async (snapshot) => {
    //       if (!snapshot.exists) {
    //         unsubscribe();
    //         resolve(true);
    //       }
    //     });
    //   });
  });
});

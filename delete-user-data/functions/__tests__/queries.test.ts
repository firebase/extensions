import * as admin from "firebase-admin";
import { UserRecord } from "firebase-admin/lib/auth/user-record";
import { buildQuery } from "../src/buildQuery";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

const environment = {
  queryCollection: "queries",
};

admin.initializeApp({ projectId: "demo-test" });
setupEnvironment();

const db = admin.firestore();
const auth = admin.auth();
let user: UserRecord;

const queryCollection = db.collection(environment.queryCollection);
const usersCollection = db.collection("users");

const generateRandomEmail = () => {
  var chars = "abcdefghijklmnopqrstuvwxyz1234567890";
  var string = "";
  for (var ii = 0; ii < 15; ii++) {
    string += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${string}@google.com`;
};

const clearCollection = async (
  collection: admin.firestore.CollectionReference
) => {
  const docs = await collection.listDocuments();

  for await (const doc of docs || []) {
    await doc.delete();
  }
};

const generateSingleWhereClauseQuery = async () => {
  await Promise.all([
    queryCollection.doc("single_where_clause").set({
      collection: "users",
      conditions: [{ where: ["id", "==", "{uid}"] }],
      recursive: true,
    }),
    queryCollection.doc("{uid}").set({
      collection: "{uid}",
    }),
  ]);
};

const generateMultipleWhereClauseQuery = async () => {
  await Promise.all([
    queryCollection.doc("multiple_where_clause").set({
      collection: "users",
      conditions: [
        { where: ["id", "==", "{uid}"] },
        { where: ["name", "==", "example"] },
      ],
      recursive: true,
    }),
    queryCollection.doc("{uid}").set({
      collection: "{uid}",
    }),
  ]);
};

describe("buildQueries", () => {
  beforeEach(async () => {
    user = await auth.createUser({ email: generateRandomEmail() });
  });

  describe("using a single where clause", () => {
    beforeEach(async () => {
      await generateSingleWhereClauseQuery();
    });

    afterEach(async () => {
      await clearCollection(queryCollection);
      await clearCollection(usersCollection);
    });

    test("Can delete a single document based on a userId", async () => {
      const userDoc = await usersCollection.add({ id: user.uid });
      const queries = await buildQuery(user.uid);

      //Assert if document has been deleted.
      await new Promise((resolve) => {
        userDoc.onSnapshot((doc) => {
          if (!doc.exists) resolve(true);
        });
      });
    });

    test("Can delete multiple documents based on a userId", async () => {
      await Promise.all([
        usersCollection.add({ id: user.uid }),
        usersCollection.add({ id: user.uid }),
      ]);

      const queries = await buildQuery(user.uid);

      //Assert if document has been deleted.
      return new Promise((resolve) => {
        usersCollection.onSnapshot((collection) => {
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
      const doc = await usersCollection.add({ id: "testing" });
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

    test("Can delete a subcollection document based on a userId", async () => {
      const doc = await db.collection("collection_1").add({ id: "testing" });
      const subCollection = doc.collection("users");
      await subCollection.doc(`${user.uid}`).set({ id: "test" });

      const queries = await buildQuery(user.uid);

      //Assert if document has been deleted.
      return new Promise((resolve) => {
        subCollection.onSnapshot((collection) => {
          if (collection.docs.length === 0) resolve(true);
        });
      });
    });
  });

  describe("multiple clauses", () => {
    beforeEach(async () => {
      await generateMultipleWhereClauseQuery();
    });

    afterEach(async () => {
      // await clearCollection(queryCollection);
      await clearCollection(usersCollection);
    });

    test("Can delete documents based on multiple where clauses", async () => {
      const userDoc = await usersCollection.add({ id: user.uid });
      const userDoc2 = await usersCollection.add({
        id: user.uid,
        name: "example",
      });

      const queries = await buildQuery(user.uid);

      //Assert if both documents has been deleted.
      await Promise.all([
        new Promise((resolve) => {
          userDoc.onSnapshot((doc) => {
            if (!doc.exists) resolve(true);
          });
        }),
        new Promise((resolve) => {
          userDoc2.onSnapshot((doc) => {
            if (!doc.exists) resolve(true);
          });
        }),
      ]);
    });
  });
});

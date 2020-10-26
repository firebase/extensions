const admin = require("firebase-admin");
const faker = require("faker");

const [projectId, collection] = process.argv.slice(2);

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: `https://${projectId}.firebaseio.com`,
});

const UPDATE_DOC = "update_test_doc_";
const doNotDeleteIds = [];
const addUpdatePromises = [];
const deletePromises = [];

const colRef = admin.firestore().collection(collection);

function data() {
  return {
    prop1: [faker.random.word(), faker.random.word(), faker.random.word()],
    prop2: faker.random.word(),
    prop3: faker.random.number(),
    prop4: faker.random.boolean(),
    prop5: new admin.firestore.GeoPoint(
      faker.random.number(90),
      faker.random.number(90)
    ),
    prop6: admin.firestore.Timestamp.now(),
    prop7: colRef.doc(faker.random.word()),
    prop8: {
      one: faker.random.word(),
      two: faker.random.number(),
      three: faker.random.boolean(),
    },
  };
}

Array.from({ length: 10 }).forEach((val, i) => {
  const document = colRef.add(data());

  addUpdatePromises.push(document);

  const updateDocId = UPDATE_DOC + i;
  const updateDoc = colRef.doc(updateDocId).set(data());

  doNotDeleteIds.push(updateDocId);

  addUpdatePromises.push(updateDoc);
});

async function queryFirestore() {
  // add docs and update existing docs
  await Promise.all(addUpdatePromises);
  // get 10 added docs to delete
  const querySnapshot = await colRef
    .where(admin.firestore.FieldPath.documentId(), "not-in", doNotDeleteIds)
    .limit(10)
    .get();

  querySnapshot.forEach((doc) => {
    deletePromises.push(colRef.doc(doc.id).delete());
  });
  // delete all but the 10 existing documents
  return Promise.all(deletePromises);
}

queryFirestore();

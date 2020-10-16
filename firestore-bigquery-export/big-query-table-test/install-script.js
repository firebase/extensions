const admin = require("firebase-admin");
const faker = require("faker");

const [projectId, collection] = process.argv.slice(2);

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: `https://${projectId}.firebaseio.com`,
});

const UPDATE_DOC = "update_test_doc";

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
    prop7: admin
      .firestore()
      .collection(collection)
      .doc(faker.random.word()),  
  };
}

const promises = [];

Array.from({ length: 9 }).forEach(() => {
  const document = admin
    .firestore()
    .collection(collection)
    .add(data());

  promises.push(document);
});

const update = admin
  .firestore()
  .collection(collection)
  .doc(UPDATE_DOC)
  .set(data());

  promises.push(update);

return Promise.all(promises);
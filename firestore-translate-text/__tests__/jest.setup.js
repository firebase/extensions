const functionsTestInit = require("firebase-functions-test");

global.snapshot = (
  input = { input: "hello" },
  path = "translations/id1"
) => {
  let functionsTest = functionsTestInit();
  return functionsTest.firestore.makeDocumentSnapshot(input, path);
};

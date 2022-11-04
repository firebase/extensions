import * as functions from "firebase-functions";

export const findDocumentReferences = functions.https.onRequest(
  (request, response) => {
    /** Simply send back the data that we have posted */
    response.send(["searchFunction/testing/functions-testing/example"]);
  }
);

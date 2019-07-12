import * as functions from "firebase-functions";

export const internal = (e: Error) =>
  new functions.https.HttpsError("internal", JSON.stringify(e));

export const invalidDocPathField = () =>
  new functions.https.HttpsError(
    "invalid-argument",
    "DocPath or field are invalid"
  );

export const missingToken = () =>
  new functions.https.HttpsError(
    "invalid-argument",
    "Invitation token invalid or expired"
  );

export const unauthenticated = () =>
  new functions.https.HttpsError(
    "unauthenticated",
    "User must be authenticated to call this function"
  );

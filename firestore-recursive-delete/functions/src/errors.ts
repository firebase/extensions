import * as functions from "firebase-functions";

export const invalidArgument = (argument: string) =>
  new functions.https.HttpsError(
    "invalid-argument",
    `Must specify a '${argument}' argument.`
  );

export const permissionDenied = () =>
  new functions.https.HttpsError(
    "permission-denied",
    "User must have the 'fsdelete' custom claim set to 'true'"
  );

export const unauthenticated = () =>
  new functions.https.HttpsError(
    "unauthenticated",
    "User must be authenticated to call this function"
  );

export const unknown = (e: Error) =>
  new functions.https.HttpsError("unknown", JSON.stringify(e));

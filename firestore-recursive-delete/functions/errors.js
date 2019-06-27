const invalidArgument = (argument) =>
  new functions.https.HttpsError(
    "invalid-argument",
    `Must specify a '${argument}' argument.`
  );

const permissionDenied = () =>
  new functions.https.HttpsError(
    "permission-denied",
    "User must have the 'fsdelete' custom claim set to 'true'"
  );

const unauthenticated = () =>
  new functions.https.HttpsError(
    "unauthenticated",
    "User must be authenticated to call this function"
  );

const unknown = (e) =>
  new functions.https.HttpsError("unknown", JSON.stringify(e));

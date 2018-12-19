/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const functions = require("firebase-functions");
const firebase_tools = require("firebase-tools");

exports.fsdelete = functions.https.onCall((data, context) => {
  const auth = context.auth;
  if (!(auth && auth.uid)) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to call this function"
    );
  }

  if (!(auth.token && auth.token.fsdelete)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User must have the 'fsdelete' custom claim set to 'true'"
    );
  }

  if (!data.path) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Must specify a 'path' argument."
    );
  }

  console.log(
    `[fsdelete] User ${context.auth.uid} has requested to delete path ${
      data.path
    }`
  );

  const deletePath = data.path;
  return firebase_tools.firestore
    .delete(deletePath, {
      project: process.env.PROJECT_ID,
      recursive: true,
      yes: true,
    })
    .then(() => {
      console.log("[fsdelete] Delete success");
      return {
        path: deletePath,
      };
    })
    .catch((e) => {
      console.warn("[fsdelete] Delete failure", e);
      console.error(
        new functions.https.HttpsError("unknown", JSON.stringify(e))
      );
    });
});

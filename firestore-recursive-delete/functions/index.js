/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const functions = require("firebase-functions");
const tools = require("firebase-tools");

const {
  invalidArgument,
  permissionDenied,
  unauthenticated,
  unknown,
} = require("./errors");

console.log("[fsdelete] Initialising mod with configuration", {
  location: process.env.LOCATION,
});

exports.fsdelete = functions.https.onCall(async (data, context) => {
  console.log("[fsdelete] Started mod execution with configuration", {
    location: process.env.LOCATION,
  });

  const { auth } = context;
  if (!(auth && auth.uid)) {
    console.warn("[fsdelete] Unable to delete, the user is unauthenticated");
    throw unauthenticated();
  }

  const { token } = auth;
  if (!(token && token.fsdelete)) {
    console.warn(
      "[fsdelete] Unable to delete, the user does not have the 'fsdelete' custom claim"
    );
    throw permissionDenied();
  }

  const { path: deletePath } = data;
  if (!deletePath) {
    console.warn("[fsdelete] Unable to delete, no 'path' is specified");
    throw invalidArgument("path");
  }

  console.log(
    `[fsdelete] User: ${
      context.auth.uid
    } has requested to delete path: '${deletePath}'`
  );

  try {
    await tools.firestore.delete(deletePath, {
      project: process.env.PROJECT_ID,
      recursive: true,
      yes: true,
    });
    console.log(`[fsdelete] Path: '${deletePath}' was successfully deleted`);
    return {
      path: deletePath,
    };
  } catch (e) {
    console.error(`[fsdelete] Error when trying to delete: '${deletePath}'`, e);
    throw unknown(e);
  }
});

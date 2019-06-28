/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import * as functions from "firebase-functions";
import * as tools from "firebase-tools";

import * as assertions from "./assertions";
import * as httpErrors from "./errors";
import * as logs from "./logs";

logs.init();

exports.fsdelete = functions.https.onCall(async (data, context) => {
  logs.start();

  const { auth } = context;
  assertions.userIsAuthenticated(auth);

  const { token, uid } = auth;
  assertions.userHasClaim(token);

  const { path: deletePath } = data;
  assertions.pathExists(deletePath);

  logs.deletePath(uid, deletePath);

  try {
    await tools.firestore.delete(deletePath, {
      project: process.env.PROJECT_ID,
      recursive: true,
      yes: true,
    });
    logs.success(deletePath);
    return {
      path: deletePath,
    };
  } catch (err) {
    logs.error(deletePath, err);
    throw httpErrors.unknown(err);
  }
});

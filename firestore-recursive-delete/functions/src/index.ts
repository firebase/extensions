/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

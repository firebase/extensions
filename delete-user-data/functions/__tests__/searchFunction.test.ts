/**
 * Copyright 2026 Google LLC
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

import * as admin from "firebase-admin";
import { UserRecord } from "firebase-functions/v1/auth";
import { createFirebaseUser, waitForDocumentDeletion } from "./helpers";
import setupEnvironment from "../__tests__/helpers/setupEnvironment";

setupEnvironment();

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

describe("search", () => {
  let user: UserRecord;

  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  test("can delete a single document", async () => {
    await admin
      .firestore()
      .collection("searchFunction")
      .doc("testing")
      .collection("functions-testing")
      .doc("example")
      .set({ functions: "testing" });

    const doc = db.doc("functions/functions-testing");

    await auth.deleteUser(user.uid);

    await waitForDocumentDeletion(doc);
  }, 12000);
});

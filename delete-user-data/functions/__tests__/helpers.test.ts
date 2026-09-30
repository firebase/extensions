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
import setupEnvironment from "./helpers/setupEnvironment";

import { hasValidUserPath, getDatabaseUrl } from "../src/helpers";
import { createFirebaseUser } from "./helpers";

admin.initializeApp();
setupEnvironment();

const db = admin.firestore();
const collection = db.collection("hasValidUserPath");
let user: UserRecord;

describe("helpers", () => {
  describe("Test Realtime Database URL helper function", () => {
    test("Can return the correct url for us-central-1", () => {
      const environment = {
        SELECTED_DATABASE_INSTANCE: "server-name",
        SELECTED_DATABASE_LOCATION: "us-central1",
      };

      const serverUrl = getDatabaseUrl(
        environment.SELECTED_DATABASE_INSTANCE,
        environment.SELECTED_DATABASE_LOCATION
      );
      expect(serverUrl).toBe(
        `https://${environment.SELECTED_DATABASE_INSTANCE}.firebaseio.com`
      );
    });

    test("Can return the correct url for europe-west1", () => {
      const environment = {
        SELECTED_DATABASE_INSTANCE: "server-name",
        SELECTED_DATABASE_LOCATION: "europe-west1",
      };

      const serverUrl = getDatabaseUrl(
        environment.SELECTED_DATABASE_INSTANCE,
        environment.SELECTED_DATABASE_LOCATION
      );
      expect(serverUrl).toBe(
        `https://${environment.SELECTED_DATABASE_INSTANCE}.europe-west1.firebasedatabase.app`
      );
    });

    test("Can return the correct url for asia-southeast1", () => {
      const environment = {
        SELECTED_DATABASE_INSTANCE: "server-name",
        SELECTED_DATABASE_LOCATION: "asia-southeast1",
      };

      const serverUrl = getDatabaseUrl(
        environment.SELECTED_DATABASE_INSTANCE,
        environment.SELECTED_DATABASE_LOCATION
      );
      expect(serverUrl).toBe(
        `https://${environment.SELECTED_DATABASE_INSTANCE}.asia-southeast1.firebasedatabase.app`
      );
    });

    test("Return null if instance is undefined", () => {
      const environment = {
        SELECTED_DATABASE_INSTANCE: undefined,
        SELECTED_DATABASE_LOCATION: "asia-southeast1",
      };

      const serverUrl = getDatabaseUrl(
        environment.SELECTED_DATABASE_INSTANCE,
        environment.SELECTED_DATABASE_LOCATION
      );
      expect(serverUrl).toBe(null);
    });

    test("Return null if location is undefined", () => {
      const environment = {
        SELECTED_DATABASE_INSTANCE: "server-name",
        SELECTED_DATABASE_LOCATION: undefined,
      };

      const serverUrl = getDatabaseUrl(
        environment.SELECTED_DATABASE_INSTANCE,
        environment.SELECTED_DATABASE_LOCATION
      );
      expect(serverUrl).toBe(null);
    });
  });

  describe("hasValidUserPath", () => {
    DocumentReference: beforeAll(async () => {
      /** create a test user */
      user = await createFirebaseUser();
    });
    test("should return true if the path matches a valid string", async () => {
      /** create a string example field value  */
      const stringDoc = await collection.add({ field1: user.uid });

      /** get the result */
      const result = await hasValidUserPath(stringDoc, "", user.uid);

      /** check the result */
      expect(result).toBeTruthy();
    });

    test("should return true if the path matches a valid string path", async () => {
      /** create a string example field value  */
      const stringDoc = await collection.add({ field1: `testing/${user.uid}` });

      /** get the result */
      const result = await hasValidUserPath(stringDoc, "", user.uid);

      /** check the result */
      expect(result).toBeTruthy();
    });

    test("should return false if with a non string value", async () => {
      /** create a string example field value  */
      const stringDoc = await collection.add({ field1: 1234 });

      /** get the result */
      const result = await hasValidUserPath(stringDoc, "", user.uid);

      /** check the result */
      expect(result).toBeFalsy();
    });
  });
});

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

import * as functionsTestInit from "firebase-functions-test";

export const snapshot = (
  input = { input: "hello" },
  path = "translations/id1"
) => {
  let functionsTest = functionsTestInit();
  return functionsTest.firestore.makeDocumentSnapshot(input, path);
};

export const mockDocumentSnapshotFactory = (documentSnapshot) => {
  return jest.fn().mockImplementation(() => {
    return {
      exists: true,
      get: documentSnapshot.get.bind(documentSnapshot),
      ref: { path: documentSnapshot.ref.path },
    };
  })();
};

export const makeChange = (before, after) => {
  let functionsTest = functionsTestInit();
  return functionsTest.makeChange(before, after);
};

export const mockFirestoreTransaction = jest.fn().mockImplementation(() => {
  return (transactionHandler) => {
    transactionHandler({
      update(ref, field, data) {
        mockFirestoreUpdate(field, data);
      },
    });
  };
});

export const mockFirestoreUpdate = jest.fn();

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

import { getChangeType } from "../src/util";
import * as functionsTestInit from "firebase-functions-test";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { DocumentSnapshot } from "firebase-functions/lib/v1/providers/firestore";

const functionsTest = functionsTestInit();
const {
  firestore: { makeDocumentSnapshot },
} = functionsTest;

export const makeChange = (before, after) => {
  return functionsTest.makeChange(before, after);
};

describe("util.getChangeType", () => {
  test("return a delete change type", () => {
    const before: DocumentSnapshot = makeDocumentSnapshot(
      { foo: "bar" },
      "docs/1"
    );
    const after: DocumentSnapshot = makeDocumentSnapshot([], "docs/1");
    const changeType: ChangeType = getChangeType(makeChange(before, after));

    expect(changeType === ChangeType.DELETE).toBeTruthy();
  });

  test("return a create change type", () => {
    const before: DocumentSnapshot = makeDocumentSnapshot([], "docs/1");
    const after: DocumentSnapshot = makeDocumentSnapshot(
      { foo: "bar" },
      "docs/1"
    );

    const changeType: ChangeType = getChangeType(makeChange(before, after));

    expect(changeType === ChangeType.CREATE).toBeTruthy();
  });

  test("return a update change type", () => {
    const before: DocumentSnapshot = makeDocumentSnapshot(
      { foo: "bar" },
      "docs/1"
    );

    const after: DocumentSnapshot = makeDocumentSnapshot(
      { foo: "bars" },
      "docs/1"
    );
    const changeType: ChangeType = getChangeType(makeChange(before, after));

    expect(changeType === ChangeType.UPDATE).toBeTruthy();
  });
});

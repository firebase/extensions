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

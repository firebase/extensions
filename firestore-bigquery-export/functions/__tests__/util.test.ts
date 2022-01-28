import { getChangeType, getWildcardParamsValues } from "../src/util";
import * as functionsTestInit from "firebase-functions-test";
import { ChangeType } from "@posiek07/fbct";
import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore";
import mockedEnv from "mocked-env";

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
    const after: DocumentSnapshot = makeDocumentSnapshot(null, "docs/1");
    const changeType: ChangeType = getChangeType(makeChange(before, after));

    expect(changeType === ChangeType.DELETE).toBeTruthy();
  });

  test("return a create change type", () => {
    const before: DocumentSnapshot = makeDocumentSnapshot(null, "docs/1");
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

describe("util.getWildcardParamsValues", () => {
  test("create params object for wildcards ids", () => {
    const configCollectionPath =
      "wildcard-test/{user_id}/subcoll/{post_id}/attachments";
    const docRefPath =
      "wildcard-test/user_1/subcoll/post_1/attachments/attachment_1";

    const docPathRef = getWildcardParamsValues(
      docRefPath,
      configCollectionPath
    );
    expect(docPathRef.user_id).toBe("user_1");
    expect(docPathRef.post_id).toBe("post_1");
  });
  test("returns params to be null if no wildcards", () => {
    const configCollectionPath = "wildcard-test/post_1/subcoll";
    const docRefPath = "wildcard-test/post_1/subcoll/attachment_1";
    const docPathRef = getWildcardParamsValues(
      docRefPath,
      configCollectionPath
    );
    expect(docPathRef).toBe(null);
  });
  test("returns params to be 1 parameter for first wildcard ", () => {
    const configCollectionPath =
      "wildcard-test/{user_id}/subcoll/post_1/attachments";
    const docRefPath =
      "wildcard-test/user_1/subcoll/post_1/attachments/attachment_1";
    const docPathRef = getWildcardParamsValues(
      docRefPath,
      configCollectionPath
    );
    expect(docPathRef.user_id).toBe("user_1");
  });
  test("returns params to be 1 parameter for last wildcard ", () => {
    const configCollectionPath =
      "wildcard-test/user_1/subcoll/{post_id}/attachments";
    const docRefPath =
      "wildcard-test/user_1/subcoll/post_1/attachments/attachment_1";
    const docPathRef = getWildcardParamsValues(
      docRefPath,
      configCollectionPath
    );
    expect(docPathRef.post_id).toBe("post_1");
  });
});

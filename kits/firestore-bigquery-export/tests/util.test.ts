import { ChangeType } from "@firebase/firestore-bigquery-change-tracker";
import type { Change, DocumentSnapshot } from "firebase-functions/firestore";
import { describe, expect, test } from "vitest";
import { getChangeType, getDocumentId, resolveWildcardIds } from "../src/util";

/** Builds a fake Firestore snapshot with just the fields the utils read. */
function snap(
  exists: boolean,
  id: string,
  data: unknown = {}
): DocumentSnapshot {
  return { exists, id, data: () => data } as unknown as DocumentSnapshot;
}

/** Builds a fake Change<DocumentSnapshot> from before/after snapshots. */
function change(
  before: DocumentSnapshot,
  after: DocumentSnapshot
): Change<DocumentSnapshot> {
  return { before, after } as Change<DocumentSnapshot>;
}

describe("getChangeType", () => {
  test("before missing => CREATE", () => {
    const c = change(snap(false, "doc1"), snap(true, "doc1", { foo: "bar" }));
    expect(getChangeType(c)).toBe(ChangeType.CREATE);
  });

  test("after missing => DELETE", () => {
    const c = change(snap(true, "doc1", { foo: "bar" }), snap(false, "doc1"));
    expect(getChangeType(c)).toBe(ChangeType.DELETE);
  });

  test("both present => UPDATE", () => {
    const c = change(
      snap(true, "doc1", { foo: "a" }),
      snap(true, "doc1", { foo: "b" })
    );
    expect(getChangeType(c)).toBe(ChangeType.UPDATE);
  });
});

describe("getDocumentId", () => {
  test("prefers after.id when after exists", () => {
    const c = change(snap(true, "before-id"), snap(true, "after-id"));
    expect(getDocumentId(c)).toBe("after-id");
  });

  test("falls back to before.id on delete", () => {
    const c = change(snap(true, "before-id"), snap(false, "after-id"));
    expect(getDocumentId(c)).toBe("before-id");
  });
});

describe("resolveWildcardIds", () => {
  test("extracts a single wildcard", () => {
    expect(
      resolveWildcardIds(
        "regions/{regionId}/countries",
        "regions/asia/countries"
      )
    ).toEqual({ regionId: "asia" });
  });

  test("extracts multiple wildcards", () => {
    expect(
      resolveWildcardIds(
        "regions/{regionId}/users/{userId}",
        "regions/asia/users/u42"
      )
    ).toEqual({ regionId: "asia", userId: "u42" });
  });

  test("returns empty object when no wildcards", () => {
    expect(
      resolveWildcardIds("regions/asia/countries", "regions/asia/countries")
    ).toEqual({});
  });

  test("maps wildcards positionally by segment", () => {
    expect(resolveWildcardIds("a/{x}/b/{y}", "a/1/b/2")).toEqual({
      x: "1",
      y: "2",
    });
  });
});

import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { getRowsFromDocs } from "../src/helper";

describe("getRowsFromDocs", () => {
  it("transforms basic Firestore documents into correct row format", () => {
    const mockDocs = [
      {
        id: "doc1",
        ref: {
          path: "users/doc1",
        },
        data: () => ({
          name: "John Doe",
          age: 30,
        }),
      },
    ] as any[];

    const mockConfig = {
      projectId: "test-project",
      sourceCollectionPath: "users",
      queryCollectionGroup: false,
    } as any;

    const beforeTimestamp = new Date().toISOString();
    const result = getRowsFromDocs(mockDocs, mockConfig);
    const afterTimestamp = new Date().toISOString();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      operation: ChangeType.IMPORT,
      documentName:
        "projects/test-project/databases/(default)/documents/users/doc1",
      documentId: "doc1",
      pathParams: {},
      eventId: "",
      data: {
        name: "John Doe",
        age: 30,
      },
    });

    expect(result[0].timestamp >= beforeTimestamp).toBeTruthy();
    expect(result[0].timestamp <= afterTimestamp).toBeTruthy();
  });

  it("correctly extracts wildcard parameters from document paths", () => {
    const mockDocs = [
      {
        id: "paris",
        ref: {
          path: "regions/europe/countries/france/cities/paris",
        },
        data: () => ({
          population: 2161000,
          isCapital: true,
        }),
      },
    ] as any[];

    const mockConfig = {
      projectId: "test-project",
      sourceCollectionPath: "regions/{regionId}/countries/{countryId}/cities",
      queryCollectionGroup: false,
    } as any;

    const result = getRowsFromDocs(mockDocs, mockConfig);

    expect(result).toHaveLength(1);
    expect(result[0].pathParams).toEqual({
      regionId: "europe",
      countryId: "france",
    });
    expect(result[0].documentName).toBe(
      "projects/test-project/databases/(default)/documents/regions/europe/countries/france/cities/paris"
    );
    expect(result[0].documentId).toBe("paris");
    expect(result[0].data).toEqual({
      population: 2161000,
      isCapital: true,
    });
  });

  it("correctly extracts wildcard parameters from document paths 2", () => {
    const mockDocs = [
      {
        id: "paris",
        ref: {
          path: "my/cool/collection/doc1",
        },
        data: () => ({
          population: 2161000,
          isCapital: true,
        }),
      },
    ] as any[];

    const mockConfig = {
      projectId: "test-project",
      sourceCollectionPath: "my/{testId}/collection",
      queryCollectionGroup: false,
    } as any;

    const result = getRowsFromDocs(mockDocs, mockConfig);

    console.log(result);

    expect(result).toHaveLength(1);
    expect(result[0].pathParams).toEqual({
      testId: "cool",
    });
    expect(result[0].documentName).toBe(
      "projects/test-project/databases/(default)/documents/my/cool/collection/doc1"
    );
    expect(result[0].documentId).toBe("paris");
    expect(result[0].data).toEqual({
      population: 2161000,
      isCapital: true,
    });
  });

  it("handles collection group queries correctly", () => {
    // These documents have the same collection name 'users' but at different paths
    const mockDocs = [
      {
        id: "user1",
        ref: {
          path: "organizations/org1/users/user1",
        },
        data: () => ({
          name: "John",
        }),
      },
      {
        id: "user2",
        ref: {
          path: "organizations/org2/users/user2",
        },
        data: () => ({
          name: "Jane",
        }),
      },
      {
        id: "user3",
        ref: {
          path: "teams/team1/users/user3", // Different parent path
        },
        data: () => ({
          name: "Bob",
        }),
      },
    ] as any[];

    const mockConfig = {
      projectId: "test-project",
      sourceCollectionPath: "organizations/{orgId}/users", // Template path
      queryCollectionGroup: true,
    } as any;

    const result = getRowsFromDocs(mockDocs, mockConfig);

    // Should only include documents that match the template path pattern
    expect(result).toHaveLength(2);

    // First document should match and have correct path params
    expect(result[0].pathParams).toEqual({
      orgId: "org1",
    });
    expect(result[0].documentName).toBe(
      "projects/test-project/databases/(default)/documents/organizations/org1/users/user1"
    );

    // Second document should match and have correct path params
    expect(result[1].pathParams).toEqual({
      orgId: "org2",
    });
    expect(result[1].documentName).toBe(
      "projects/test-project/databases/(default)/documents/organizations/org2/users/user2"
    );

    // The third document (teams/team1/users/user3) should have been filtered out
    // as it doesn't match the template path pattern
  });
});

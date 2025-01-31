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

  it("handles collection group queries with underscore paths correctly", () => {
    // Test collection group queries with both regular and underscore paths
    const mockDocs = [
      {
        id: "doc1",
        ref: {
          path: "my/test1/collection/doc1",
        },
        data: () => ({
          value: 1,
        }),
      },
      {
        id: "doc2",
        ref: {
          path: "my_other/test2/collection/doc2",
        },
        data: () => ({
          value: 2,
        }),
      },
      {
        id: "doc3",
        ref: {
          path: "different/test3/collection/doc3",
        },
        data: () => ({
          value: 3,
        }),
      },
    ] as any[];

    // Test with my/{coolId}/collection
    const myConfig = {
      projectId: "test-project",
      sourceCollectionPath: "my/{coolId}/collection",
      queryCollectionGroup: true,
    } as any;

    const myResult = getRowsFromDocs(mockDocs, myConfig);
    expect(myResult).toHaveLength(1);
    expect(myResult[0].pathParams).toEqual({
      coolId: "test1",
    });
    expect(myResult[0].documentName).toBe(
      "projects/test-project/databases/(default)/documents/my/test1/collection/doc1"
    );

    // Test with my_other/{coolId}/collection
    const myOtherConfig = {
      projectId: "test-project",
      sourceCollectionPath: "my_other/{coolId}/collection",
      queryCollectionGroup: true,
    } as any;

    const myOtherResult = getRowsFromDocs(mockDocs, myOtherConfig);
    expect(myOtherResult).toHaveLength(1);
    expect(myOtherResult[0].pathParams).toEqual({
      coolId: "test2",
    });
    expect(myOtherResult[0].documentName).toBe(
      "projects/test-project/databases/(default)/documents/my_other/test2/collection/doc2"
    );
  });

  it("handles collection group queries with large batches correctly", () => {
    // Create a large batch of mixed documents to simulate real conditions
    const mockDocs = [
      // First batch - should match my_other/{coolId}/collection
      ...Array(500)
        .fill(null)
        .map((_, i) => ({
          id: `doc${i}`,
          ref: {
            path: `my_other/test${i}/collection/doc${i}`,
          },
          data: () => ({
            value: i,
          }),
        })),
      // Second batch - should not match
      ...Array(500)
        .fill(null)
        .map((_, i) => ({
          id: `other${i}`,
          ref: {
            path: `different/test${i}/collection/other${i}`,
          },
          data: () => ({
            value: i,
          }),
        })),
      // Third batch - should match my/{coolId}/collection
      ...Array(500)
        .fill(null)
        .map((_, i) => ({
          id: `another${i}`,
          ref: {
            path: `my/test${i}/collection/another${i}`,
          },
          data: () => ({
            value: i,
          }),
        })),
    ] as any[];

    // Test my_other/{coolId}/collection
    const myOtherConfig = {
      projectId: "test-project",
      sourceCollectionPath: "my_other/{coolId}/collection",
      queryCollectionGroup: true,
    } as any;

    const myOtherResult = getRowsFromDocs(mockDocs, myOtherConfig);
    expect(myOtherResult).toHaveLength(500);
    expect(myOtherResult[0].documentName).toContain(
      "my_other/test0/collection"
    );
    expect(myOtherResult[0].pathParams).toEqual({ coolId: "test0" });

    // Test my/{coolId}/collection with same batch
    const myConfig = {
      projectId: "test-project",
      sourceCollectionPath: "my/{coolId}/collection",
      queryCollectionGroup: true,
    } as any;

    const myResult = getRowsFromDocs(mockDocs, myConfig);
    expect(myResult).toHaveLength(500);
    expect(myResult[0].documentName).toContain("my/test0/collection");
    expect(myResult[0].pathParams).toEqual({ coolId: "test0" });

    // Additional assertions to verify no overlap
    const myOtherPaths = new Set(myOtherResult.map((r) => r.documentName));
    const myPaths = new Set(myResult.map((r) => r.documentName));
    const intersection = [...myOtherPaths].filter((x) => myPaths.has(x));
    expect(intersection).toHaveLength(0);

    // Verify all my_other paths start correctly
    myOtherResult.forEach((row) => {
      expect(row.documentName).toContain("my_other/");
    });

    // Verify all my paths start correctly
    myResult.forEach((row) => {
      expect(row.documentName).toContain("/my/");
    });
  });
});

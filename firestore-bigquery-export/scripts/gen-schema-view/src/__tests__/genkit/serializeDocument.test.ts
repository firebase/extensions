// First, set up the mocks before any imports
// Create mock classes for Firestore special types
class MockGeoPoint {
  latitude: number;
  longitude: number;
  constructor(lat: number, lng: number) {
    this.latitude = lat;
    this.longitude = lng;
  }
}

class MockDocumentReference {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

// Mock firebase-admin to use our mock classes - this must be done before importing firebase
jest.mock("firebase-admin", () => ({
  firestore: {
    GeoPoint: MockGeoPoint,
    DocumentReference: MockDocumentReference,
  },
}));

// Now import the dependencies after the mocks are set up
import firebase = require("firebase-admin");
import { serializeDocument } from "../../schema/genkit";

describe("serializeDocument", () => {
  test("should handle null values", () => {
    expect(serializeDocument(null)).toBeNull();
    expect(serializeDocument(undefined)).toBeNull();
  });

  test("should handle primitive values", () => {
    expect(serializeDocument("string")).toBe("string");
    expect(serializeDocument(123)).toBe(123);
    expect(serializeDocument(true)).toBe(true);
  });

  test("should handle Date objects", () => {
    const date = new Date("2023-01-01T12:00:00Z");
    const result = serializeDocument(date);

    expect(result).toEqual({
      _type: "timestamp",
      value: "2023-01-01T12:00:00.000Z",
    });
  });

  test("should handle GeoPoint objects", () => {
    const geoPoint = new MockGeoPoint(37.7749, -122.4194);
    const result = serializeDocument(geoPoint);

    expect(result).toEqual({
      _type: "geopoint",
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  test("should handle DocumentReference objects", () => {
    const docRef = new MockDocumentReference("collections/docId");
    const result = serializeDocument(docRef);

    expect(result).toEqual({
      _type: "reference",
      path: "collections/docId",
    });
  });

  test("should handle arrays", () => {
    const array = [1, "two", new Date("2023-01-01T12:00:00Z")];
    const result = serializeDocument(array);

    expect(result).toEqual([
      1,
      "two",
      { _type: "timestamp", value: "2023-01-01T12:00:00.000Z" },
    ]);
  });

  test("should handle nested objects", () => {
    const obj = {
      name: "Test",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      location: new MockGeoPoint(37.7749, -122.4194),
      ref: new MockDocumentReference("collections/docId"),
      nested: {
        array: [1, 2, 3],
        value: "nested value",
      },
    };

    const result = serializeDocument(obj);

    expect(result).toEqual({
      name: "Test",
      timestamp: { _type: "timestamp", value: "2023-01-01T12:00:00.000Z" },
      location: { _type: "geopoint", latitude: 37.7749, longitude: -122.4194 },
      ref: { _type: "reference", path: "collections/docId" },
      nested: {
        array: [1, 2, 3],
        value: "nested value",
      },
    });
  });

  test("should handle complex nested structures", () => {
    const complex = {
      users: [
        {
          name: "User 1",
          createdAt: new Date("2023-01-01T12:00:00Z"),
          location: new MockGeoPoint(37.7749, -122.4194),
        },
        {
          name: "User 2",
          createdAt: new Date("2023-01-02T12:00:00Z"),
          references: [
            new MockDocumentReference("collections/doc1"),
            new MockDocumentReference("collections/doc2"),
          ],
        },
      ],
      metadata: {
        updated: new Date("2023-01-03T12:00:00Z"),
        nested: {
          deeply: {
            value: "nested deeply",
          },
        },
      },
    };

    const result = serializeDocument(complex);

    expect(result).toEqual({
      users: [
        {
          name: "User 1",
          createdAt: { _type: "timestamp", value: "2023-01-01T12:00:00.000Z" },
          location: {
            _type: "geopoint",
            latitude: 37.7749,
            longitude: -122.4194,
          },
        },
        {
          name: "User 2",
          createdAt: { _type: "timestamp", value: "2023-01-02T12:00:00.000Z" },
          references: [
            { _type: "reference", path: "collections/doc1" },
            { _type: "reference", path: "collections/doc2" },
          ],
        },
      ],
      metadata: {
        updated: { _type: "timestamp", value: "2023-01-03T12:00:00.000Z" },
        nested: {
          deeply: {
            value: "nested deeply",
          },
        },
      },
    });
  });
});

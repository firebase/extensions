interface FirestoreModule {
  (): {
    collection: jest.Mock;
    where: jest.Mock;
    limit: jest.Mock;
    get: jest.Mock;
  };
  GeoPoint: new (latitude: number, longitude: number) => {
    latitude: number;
    longitude: number;
  };
  DocumentReference: new (path: string) => { path: string };
}

jest.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({ name: "Doc 1", value: 100 }),
          id: "doc1",
        },
        {
          data: () => ({ name: "Doc 2", value: 200 }),
          id: "doc2",
        },
      ],
    }),
  };

  class GeoPoint {
    latitude: number;
    longitude: number;
    constructor(latitude: number, longitude: number) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  }

  class DocumentReference {
    path: string;
    constructor(path: string) {
      this.path = path;
    }
  }

  const firestoreModule = jest.fn(
    () => mockFirestore
  ) as unknown as FirestoreModule;
  firestoreModule.GeoPoint = GeoPoint;
  firestoreModule.DocumentReference = DocumentReference;

  return {
    firestore: firestoreModule,
  };
});

import { sampleFirestoreDocuments } from "../../schema/genkit";

jest.mock("../../schema/genkit", () => {
  const original = jest.requireActual("../../schema/genkit");
  return {
    ...original,
    serializeDocument: (data: any) => {
      if (!data) return null;
      if (data instanceof Date) {
        return { _type: "timestamp", value: data.toISOString() };
      }
      if (typeof data === "object" && !Array.isArray(data)) {
        return Object.entries(data).reduce(
          (result: Record<string, any>, [key, value]) => {
            result[key] = value;
            return result;
          },
          {}
        );
      }
      return data;
    },
  };
});

describe.skip("sampleFirestoreDocuments", () => {
  it("should sample documents from Firestore collection", async () => {
    const collectionPath = "test-collection";
    const sampleSize = 2;

    const result = await sampleFirestoreDocuments(collectionPath, sampleSize);

    const firebase = require("firebase-admin");
    const mockFirestore = firebase.firestore();

    expect(mockFirestore.collection).toHaveBeenCalledWith(collectionPath);
    expect(mockFirestore.where).toHaveBeenCalledWith(
      "__name__",
      ">=",
      expect.any(String)
    );
    expect(mockFirestore.limit).toHaveBeenCalledWith(sampleSize);
    expect(mockFirestore.get).toHaveBeenCalled();

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("name", "Doc 1");
    expect(result[0]).toHaveProperty("value", 100);
  });

  it("should handle errors properly", async () => {
    const firebase = require("firebase-admin");
    const mockFirestore = firebase.firestore();

    mockFirestore.get.mockRejectedValueOnce(new Error("Firestore error"));

    const collectionPath = "test-collection";
    const sampleSize = 2;

    await expect(
      sampleFirestoreDocuments(collectionPath, sampleSize)
    ).rejects.toThrow("Firestore error");
  });
});

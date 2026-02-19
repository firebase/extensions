/*
 * Copyright 2025 Google LLC
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

interface FirestoreModule {
  (): {
    collection: jest.Mock;
    collectionGroup: jest.Mock;
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
    collectionGroup: jest.fn().mockReturnThis(),
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

describe("sampleFirestoreDocuments", () => {
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

  describe("collection group queries", () => {
    it("should sample documents from Firestore collection group", async () => {
      const collectionPath = "orders";
      const sampleSize = 2;
      const isCollectionGroupQuery = true;

      // Mock collection group data (subcollections from different parents)
      const firebase = require("firebase-admin");
      const mockFirestore = firebase.firestore();

      // Clear mocks and set up specific mock for this test
      jest.clearAllMocks();
      mockFirestore.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({ orderId: "order1", amount: 50, userId: "user1" }),
            id: "order1",
          },
          {
            data: () => ({ orderId: "order2", amount: 75, userId: "user2" }),
            id: "order2",
          },
        ],
      });

      const result = await sampleFirestoreDocuments(
        collectionPath,
        sampleSize,
        isCollectionGroupQuery
      );

      expect(mockFirestore.collectionGroup).toHaveBeenCalledWith(
        collectionPath
      );
      expect(mockFirestore.collection).not.toHaveBeenCalled();
      expect(mockFirestore.where).not.toHaveBeenCalled();
      expect(mockFirestore.limit).toHaveBeenCalledWith(sampleSize);
      expect(mockFirestore.get).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("orderId", "order1");
      expect(result[0]).toHaveProperty("amount", 50);
      expect(result[0]).toHaveProperty("userId", "user1");
    });

    it("should default to regular collection query when isCollectionGroupQuery is false", async () => {
      const collectionPath = "test-collection";
      const sampleSize = 2;
      const isCollectionGroupQuery = false;

      const firebase = require("firebase-admin");
      const mockFirestore = firebase.firestore();

      // Clear mocks for this test
      jest.clearAllMocks();

      const result = await sampleFirestoreDocuments(
        collectionPath,
        sampleSize,
        isCollectionGroupQuery
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith(collectionPath);
      expect(mockFirestore.collectionGroup).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("should handle errors properly for collection group queries", async () => {
      const firebase = require("firebase-admin");
      const mockFirestore = firebase.firestore();

      // Clear mocks and set up error for this test
      jest.clearAllMocks();
      mockFirestore.get.mockRejectedValueOnce(
        new Error("Collection group error")
      );

      const collectionPath = "orders";
      const sampleSize = 2;
      const isCollectionGroupQuery = true;

      await expect(
        sampleFirestoreDocuments(
          collectionPath,
          sampleSize,
          isCollectionGroupQuery
        )
      ).rejects.toThrow("Collection group error");
    });
  });
});

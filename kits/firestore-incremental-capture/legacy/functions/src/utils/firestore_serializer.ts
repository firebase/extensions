/**
 * Copyright 2023 Google LLC
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

import * as traverse from "traverse";

import {
  DocumentReference,
  GeoPoint,
  Timestamp,
} from "firebase-admin/firestore";

export const firestoreSerializer = (data: any) => {
  return traverse(data).reduce(function (acc, property) {
    if (this.isRoot) return acc;

    if (Buffer.isBuffer(property)) {
      if (this.key) {
        acc[this.key] = {
          type: "binary",
          value: property.toString("base64"),
        };
      }

      this.delete(true);
      return acc;
    }

    /** Handle array types */
    if (Array.isArray(property)) {
      if (this.key)
        acc[this.key] = {
          type: "array",
          value: property.map((item) => {
            // If the item is a primitive, return the serialized format
            if (typeof item !== "object" || item === null) {
              return { type: typeof item, value: item };
            }
            // If the item is an object (including array), recursively serialize it
            return firestoreSerializer(item);
          }),
        };
      this.delete(true);
      return acc;
    }

    // Handle GeoPoint special type
    if (property instanceof GeoPoint) {
      if (this.key)
        acc[this.key] = {
          type: "geopoint",
          value: {
            latitude: {
              type: "number",
              value: property.latitude,
            },
            longitude: {
              type: "number",
              value: property.longitude,
            },
          },
        };
      this.delete(true); // Delete this node and halt further traversal for its children
      return acc;
    }

    // Handle Timestamp special type
    if (property instanceof Timestamp) {
      const date = property.toDate(); // Convert Timestamp to JavaScript Date
      if (this.key)
        acc[this.key] = {
          type: "timestamp",
          value: date.toISOString(), // Convert Date to ISO string
        };
      this.delete(true);
      return acc;
    }

    // Handle DocumentReference special type
    if (property instanceof DocumentReference) {
      if (this.key)
        acc[this.key] = {
          type: "documentReference",
          value: property.path, // Assuming DocumentReference has a 'path' property
        };
      this.delete(true);
      return acc;
    }

    if (property === null) {
      if (this.key)
        acc[this.key] = {
          type: "null", // Set the type as 'null'
          value: null,
        };
      return acc;
    }

    // Handle object type nodes
    if (!this.isLeaf) {
      /** Handle array types */
      if (Array.isArray(property)) {
        if (this.key)
          acc[this.key] = {
            type: "array",
            value: property.map((item) => firestoreSerializer(item)),
          };
        this.delete(true);
        return acc;
      }

      // If it's an object but not a special type, serialize it
      else if (typeof property === "object" && property !== null) {
        if (this.key)
          acc[this.key] = {
            type: "map",
            value: firestoreSerializer(property), // Recursive serialization
          };
        this.delete(true);
        return acc;
      }

      return acc;
    }

    // Decide the accumulator context based on the parent node type
    const context =
      this.parent?.node && this.parent.node.type === "object"
        ? this.parent?.node.value
        : acc;

    if (this.key)
      context[this.key] = { type: typeof property, value: property };

    return acc;
  }, {});
};

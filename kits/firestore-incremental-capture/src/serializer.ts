/*
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

import {
  DocumentReference,
  GeoPoint,
  Timestamp,
} from "firebase-admin/firestore";

/**
 * Tag identifying how a serialized value should be reconstructed. Firestore's
 * own types are named explicitly; everything else carries its `typeof` tag.
 */
export type SerializedType =
  | "array"
  | "binary"
  | "geopoint"
  | "map"
  | "null"
  | "reference"
  | "timestamp"
  | "bigint"
  | "boolean"
  | "number"
  | "string";

/** A single tagged value in a serialized document. */
export interface SerializedValue {
  type: SerializedType;
  value: unknown;
}

/** A serialized Firestore document: field name to tagged value. */
export type SerializedDocument = Record<string, SerializedValue>;

/**
 * Serializes Firestore document data into a self-describing tree.
 *
 * Every value carries the tag needed to rebuild it, because the changelog round
 * trips through BigQuery JSON columns, which cannot represent a Timestamp,
 * GeoPoint, DocumentReference or Buffer.
 *
 * The tags are a wire format shared with the Dataflow restoration pipeline:
 * `FirestoreReconstructor.buildFirestoreMap` upper-cases each tag and switches
 * on it, dropping any field whose tag it does not recognise. Renaming a tag on
 * one side silently discards data on restore. `reference` is spelled to match
 * the pipeline's `REFERENCE` case, and carries the relative document path
 * because the pipeline prefixes `projects/…/databases/…/documents/` itself.
 *
 * The pipeline has no case for `binary` or `null`, so those fields are dropped
 * on restore. See the restoration gaps section of the kit README.
 *
 * @param data - Firestore document data, or `undefined` for a document that
 *   does not exist on this side of the change.
 * @returns The serialized document; empty for `undefined`/`null` input.
 */
export function serializeDocument(data: unknown): SerializedDocument {
  if (data === null || data === undefined || typeof data !== "object") {
    return {};
  }

  const serialized: SerializedDocument = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    serialized[key] = serializeValue(value);
  }

  return serialized;
}

/**
 * Serializes a single value, recursing through maps and arrays.
 *
 * @param value - The value to serialize.
 * @returns The tagged value.
 */
function serializeValue(value: unknown): SerializedValue {
  if (value === null || value === undefined) {
    return { type: "null", value: null };
  }

  if (Buffer.isBuffer(value)) {
    return { type: "binary", value: value.toString("base64") };
  }

  if (value instanceof Timestamp) {
    return { type: "timestamp", value: value.toDate().toISOString() };
  }

  if (value instanceof GeoPoint) {
    return {
      type: "geopoint",
      value: {
        latitude: { type: "number", value: value.latitude },
        longitude: { type: "number", value: value.longitude },
      },
    };
  }

  if (value instanceof DocumentReference) {
    return { type: "reference", value: value.path };
  }

  if (Array.isArray(value)) {
    return { type: "array", value: value.map(serializeArrayElement) };
  }

  if (typeof value === "object") {
    return { type: "map", value: serializeDocument(value) };
  }

  return { type: typeof value as SerializedType, value };
}

/**
 * Serializes one array element.
 *
 * Map elements are emitted as a bare field map, NOT wrapped in a
 * `{ type: "map" }` envelope like a map field would be. This asymmetry is
 * required by the restoration pipeline: `FirestoreReconstructor.buildFirestoreList`
 * passes each element straight to `buildFirestoreMap`, which expects field
 * names at the top level and skips anything it cannot read as a tagged field.
 * Wrapping a map element restores it as an empty map.
 *
 * Primitive elements stay tagged, matching the original extension. The pipeline
 * cannot reconstruct those either - see the restoration gaps in the README -
 * but changing the encoding here would not fix it.
 *
 * @param element - One element of a Firestore array field.
 * @returns The serialized element.
 */
function serializeArrayElement(element: unknown): unknown {
  if (
    element !== null &&
    typeof element === "object" &&
    !Array.isArray(element) &&
    !Buffer.isBuffer(element) &&
    !(element instanceof Timestamp) &&
    !(element instanceof GeoPoint) &&
    !(element instanceof DocumentReference)
  ) {
    return serializeDocument(element);
  }

  return serializeValue(element);
}

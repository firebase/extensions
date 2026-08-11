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

/**
 * Golden shapes for the changelog wire format.
 *
 * The restoration pipeline (`pipeline/`, Java) parses whatever this produces, so
 * these assertions are the contract between the two languages, not merely a
 * description of the current implementation. The expected values are
 * transcribed from the original extension's serializer tests, which are the
 * authoritative record of the format the pipeline was written against.
 *
 * One deliberate divergence: DocumentReference is tagged `reference`, not the
 * extension's `documentReference`. `FirestoreReconstructor` upper-cases the tag
 * and switches on `REFERENCE`, so the extension's spelling fell through to
 * `default: continue` and dropped the field.
 */

import { initializeApp } from "firebase-admin/app";
import {
  type DocumentReference,
  getFirestore,
  GeoPoint,
  Timestamp,
} from "firebase-admin/firestore";
import { beforeAll, describe, expect, test } from "vitest";
import { serializeDocument } from "../src/serializer";

let ref: DocumentReference;

beforeAll(() => {
  // Constructing a reference is offline; nothing here contacts Firestore.
  initializeApp({ projectId: "demo-test" });
  ref = getFirestore().doc("products/abc");
});

describe("changelog wire format", () => {
  test("tags a string, number and boolean", () => {
    expect(
      serializeDocument({ s: "Hello, Firestore!", n: 42, b: true })
    ).toEqual({
      s: { type: "string", value: "Hello, Firestore!" },
      n: { type: "number", value: 42 },
      b: { type: "boolean", value: true },
    });
  });

  test("nests a GeoPoint as tagged coordinates", () => {
    expect(
      serializeDocument({ geoPointValue: new GeoPoint(52.379189, 4.899431) })
    ).toEqual({
      geoPointValue: {
        type: "geopoint",
        value: {
          latitude: { type: "number", value: 52.379189 },
          longitude: { type: "number", value: 4.899431 },
        },
      },
    });
  });

  test("tags a DocumentReference as 'reference' with its relative path", () => {
    // The pipeline prefixes `projects/…/databases/…/documents/` itself, so the
    // value must be the relative path, and the tag must match `case "REFERENCE"`.
    expect(serializeDocument({ documentReferenceValue: ref })).toEqual({
      documentReferenceValue: { type: "reference", value: "products/abc" },
    });
  });

  test("converts a Timestamp to an ISO string", () => {
    const timestampValue = Timestamp.fromDate(
      new Date("2026-01-02T03:04:05.000Z")
    );

    expect(serializeDocument({ timestampValue })).toEqual({
      timestampValue: {
        type: "timestamp",
        value: "2026-01-02T03:04:05.000Z",
      },
    });
  });

  test("wraps a map field in a 'map' envelope", () => {
    expect(serializeDocument({ mapValue: { nested: "test" } })).toEqual({
      mapValue: {
        type: "map",
        value: { nested: { type: "string", value: "test" } },
      },
    });
  });

  test("emits array elements that are maps as bare field maps", () => {
    // No `{ type: "map" }` envelope: buildFirestoreList passes each element
    // straight to buildFirestoreMap, which reads field names at the top level.
    // Wrapping these restores them as empty maps.
    expect(
      serializeDocument({
        arrayValue: [
          {
            stringValue: "test",
            integerValue: 42,
            floatValue: 42.42,
            booleanValue: true,
            nullValue: null,
          },
        ],
      })
    ).toEqual({
      arrayValue: {
        type: "array",
        value: [
          {
            stringValue: { type: "string", value: "test" },
            integerValue: { type: "number", value: 42 },
            floatValue: { type: "number", value: 42.42 },
            booleanValue: { type: "boolean", value: true },
            nullValue: { type: "null", value: null },
          },
        ],
      },
    });
  });

  test("keeps the envelope on Firestore types nested inside an array element", () => {
    const timestampValue = Timestamp.fromDate(
      new Date("2026-01-02T03:04:05.000Z")
    );

    expect(
      serializeDocument({
        arrayValue: [
          {
            nestedString: "nestedTest",
            nestedObject: { deepNestedValue: "deepValue" },
            geoPointValue: new GeoPoint(52.379189, 4.899431),
            timestampValue,
          },
        ],
      })
    ).toEqual({
      arrayValue: {
        type: "array",
        value: [
          {
            nestedString: { type: "string", value: "nestedTest" },
            nestedObject: {
              type: "map",
              value: {
                deepNestedValue: { type: "string", value: "deepValue" },
              },
            },
            geoPointValue: {
              type: "geopoint",
              value: {
                latitude: { type: "number", value: 52.379189 },
                longitude: { type: "number", value: 4.899431 },
              },
            },
            timestampValue: {
              type: "timestamp",
              value: "2026-01-02T03:04:05.000Z",
            },
          },
        ],
      },
    });
  });

  test("tags primitive array elements individually", () => {
    expect(serializeDocument({ arrayValue: ["string", 42, true] })).toEqual({
      arrayValue: {
        type: "array",
        value: [
          { type: "string", value: "string" },
          { type: "number", value: 42 },
          { type: "boolean", value: true },
        ],
      },
    });
  });

  test("base64-encodes a Buffer", () => {
    expect(serializeDocument({ binaryValue: Buffer.from("hi") })).toEqual({
      binaryValue: { type: "binary", value: "aGk=" },
    });
  });

  test("tags null rather than omitting the field", () => {
    expect(serializeDocument({ nullValue: null })).toEqual({
      nullValue: { type: "null", value: null },
    });
  });
});

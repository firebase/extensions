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

import { GeoPoint, Timestamp } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";
import { serializeDocument } from "../src/serializer";

describe("serializeDocument", () => {
  test("returns an empty document for absent data", () => {
    expect(serializeDocument(undefined)).toEqual({});
    expect(serializeDocument(null)).toEqual({});
  });

  test("tags primitives with their typeof", () => {
    expect(serializeDocument({ a: "x", b: 1, c: true })).toEqual({
      a: { type: "string", value: "x" },
      b: { type: "number", value: 1 },
      c: { type: "boolean", value: true },
    });
  });

  test("tags null fields rather than omitting them", () => {
    expect(serializeDocument({ a: null })).toEqual({
      a: { type: "null", value: null },
    });
  });

  test("converts a Timestamp to an ISO string", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");

    expect(serializeDocument({ at: Timestamp.fromDate(date) })).toEqual({
      at: { type: "timestamp", value: "2026-01-02T03:04:05.000Z" },
    });
  });

  test("nests a GeoPoint as tagged coordinates", () => {
    expect(serializeDocument({ where: new GeoPoint(1.5, -2.5) })).toEqual({
      where: {
        type: "geopoint",
        value: {
          latitude: { type: "number", value: 1.5 },
          longitude: { type: "number", value: -2.5 },
        },
      },
    });
  });

  test("base64-encodes a Buffer", () => {
    expect(serializeDocument({ blob: Buffer.from("hi") })).toEqual({
      blob: { type: "binary", value: "aGk=" },
    });
  });

  test("recurses into maps", () => {
    expect(serializeDocument({ outer: { inner: 1 } })).toEqual({
      outer: {
        type: "map",
        value: { inner: { type: "number", value: 1 } },
      },
    });
  });

  test("recurses into arrays", () => {
    expect(serializeDocument({ list: [1, "two"] })).toEqual({
      list: {
        type: "array",
        value: [
          { type: "number", value: 1 },
          { type: "string", value: "two" },
        ],
      },
    });
  });

  test("survives a JSON round trip", () => {
    const serialized = serializeDocument({
      at: Timestamp.fromDate(new Date("2026-01-02T03:04:05.000Z")),
      nested: { list: [1, 2] },
    });

    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });
});

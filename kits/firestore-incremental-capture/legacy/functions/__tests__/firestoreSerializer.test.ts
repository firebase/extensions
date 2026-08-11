/**
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

import * as admin from "firebase-admin";

const { Timestamp, GeoPoint } = require("@google-cloud/firestore");

import { verifySchema } from "./helpers";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-project";

admin.initializeApp({ projectId: "demo-project" });

const db = admin.firestore();

/**
 * TODO: Handle binary examples
 */

describe("generateSchema", () => {
  test("should handle an string value", async () => {
    const documentPath = "products/stringExample";
    const sampleDocData = {
      stringValue: "Hello, Firestore!",
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      stringValue: { type: "string", value: "Hello, Firestore!" },
    });
  }, 12000);

  test("should handle an boolean value", async () => {
    const documentPath = "products/booleanExample";
    const sampleDocData = {
      booleanExample: true,
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      booleanExample: { type: "boolean", value: true },
    });
  }, 12000);

  test("should handle a geopoint value", async () => {
    const documentPath = "products/geoPointExample";
    const sampleDocData = {
      geopointValue: new GeoPoint(52.379189, 4.899431),
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      geopointValue: {
        type: "geopoint",
        value: {
          latitude: {
            type: "number",
            value: 52.379189,
          },
          longitude: {
            type: "number",
            value: 4.899431,
          },
        },
      },
    });
  }, 12000);

  test("should handle a document reference value", async () => {
    const documentPath = "products/documentReferenceExample";
    const ref = db.doc("products/stringExample");
    const sampleDocData = {
      documentReferenceValue: ref,
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      documentReferenceValue: {
        type: "documentReference",
        value: ref.path, // Assuming you want to store the path of the document reference
      },
    });
  }, 12000);

  test("should handle a timestamp reference value", async () => {
    const documentPath = "products/timestampExample";
    const timestampValue = Timestamp.now();
    const sampleDocData = {
      timestampValue,
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      timestampValue: {
        type: "timestamp",
        value: timestampValue.toDate().toISOString(),
      },
    });
  }, 12000);

  test("should handle an objectValue value", async () => {
    const documentPath = "products/objectValueExample";
    const sampleDocData = {
      objectValue: { foo: "bar" },
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      objectValue: {
        type: "map",
        value: {
          foo: {
            type: "string",
            value: "bar",
          },
        },
      },
    });
  }, 12000);

  test("should handle an multiple objectValue values", async () => {
    const documentPath = "products/objectValueExample";
    const sampleDocData = {
      objectValue: { foo: "bar", foo2: "bar2" },
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      objectValue: {
        type: "map",
        value: {
          foo: {
            type: "string",
            value: "bar",
          },
          foo2: {
            type: "string",
            value: "bar2",
          },
        },
      },
    });
  }, 12000);

  test("should handle an empty array value", async () => {
    const documentPath = "products/arrayValueExample";
    const sampleDocData = {
      arrayValue: [],
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      arrayValue: {
        type: "array",
        value: [],
      },
    });
  }, 12000);

  test("should handle an array with basic data types", async () => {
    const documentPath = "products/complexExample";

    const sampleDocData = {
      arrayValue: [
        {
          stringValue: "test",
          integerValue: 42,
          floatValue: 42.42,
          booleanValue: true,
          nullValue: null,
        },
      ],
    };

    await db.doc(documentPath).set(sampleDocData);

    // Define the expected result according to the behavior of the flattenData function.
    const expectedData = {
      arrayValue: {
        type: "array",
        value: [
          {
            stringValue: {
              type: "string",
              value: "test",
            },
            integerValue: {
              type: "number",
              value: 42,
            },
            floatValue: {
              type: "number",
              value: 42.42,
            },
            booleanValue: {
              type: "boolean",
              value: true,
            },
            nullValue: {
              type: "null",
              value: null,
            },
          },
        ],
      },
    };

    await verifySchema(documentPath, expectedData);
  }, 12000);

  test("should handle an array with complex data types", async () => {
    const documentPath = "products/complexArrayExample";
    const timestampValue = Timestamp.now();

    const sampleDocData = {
      arrayValue: [
        {
          nestedString: "nestedTest",
          nestedNumber: 42,
          nestedObject: {
            deepNestedValue: "deepValue",
          },
          geoPointValue: new GeoPoint(52.379189, 4.899431),
          timestampValue,
        },
      ],
    };

    await db.doc(documentPath).set(sampleDocData);

    // Define the expected result according to the behavior of the flattenData function.
    const expectedData = {
      arrayValue: {
        type: "array",
        value: [
          {
            nestedString: {
              type: "string",
              value: "nestedTest",
            },
            nestedNumber: {
              type: "number",
              value: 42,
            },
            nestedObject: {
              type: "map",
              value: {
                deepNestedValue: {
                  type: "string",
                  value: "deepValue",
                },
              },
            },
            geoPointValue: {
              type: "geopoint",
              value: {
                latitude: {
                  type: "number",
                  value: 52.379189,
                },
                longitude: {
                  type: "number",
                  value: 4.899431,
                },
              },
            },
            timestampValue: {
              type: "timestamp",
              value: timestampValue.toDate().toISOString(),
            },
          },
        ],
      },
    };

    await verifySchema(documentPath, expectedData);
  }, 12000);

  test("should handle arrays with mixed data types", async () => {
    const documentPath = "products/mixedArrayExample";
    const sampleDocData = {
      mixedArray: ["string", 42, true],
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      mixedArray: {
        type: "array",
        value: [
          { type: "string", value: "string" },
          { type: "number", value: 42 },
          { type: "boolean", value: true },
        ],
      },
    });
  }, 12000);

  test("should handle standalone numbers", async () => {
    const documentPath = "products/numberExample";
    const sampleDocData = {
      numberValue: 42.42,
    };

    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      numberValue: {
        type: "number",
        value: 42.42,
      },
    });
  }, 12000);

  test("should handle binary blob data", async () => {
    const documentPath = "products/blobExample";

    const sampleDocData = {
      blobValue: Buffer.from("some sample data", "utf8"),
    };

    db.doc(documentPath).set(sampleDocData);
    await db.doc(documentPath).set(sampleDocData);

    await verifySchema(documentPath, {
      blobValue: {
        type: "binary",
        value: Buffer.from("some sample data").toString("base64"), // Modified this line to directly use a Buffer
      },
    });
  }, 12000);

  test("should handle an integer value", async () => {
    const documentPath = "products/integerExample";

    // Sample data with an integer value
    const sampleDocData = {
      integerValue: 12345,
    };

    // Set the data in Firestore
    await db.doc(documentPath).set(sampleDocData);

    // Verify if the value in the schema (or retrieved value) matches the set value
    await verifySchema(documentPath, {
      integerValue: {
        type: "number",
        value: 12345,
      },
    });
  }, 12000);

  test("should handle a floating point value", async () => {
    const documentPath = "products/floatingPointExample";

    // Sample data with a floating point value
    const sampleDocData = {
      floatValue: 123.45,
    };

    // Set the data in Firestore
    await db.doc(documentPath).set(sampleDocData);

    // Verify if the value in the schema (or retrieved value) matches the set value
    await verifySchema(documentPath, {
      floatValue: {
        type: "number",
        value: 123.45,
      },
    });
  }, 12000);

  test("should handle a null value", async () => {
    const documentPath = "products/nullValueExample";
    const sampleDocData = {
      nullableField: null,
    };

    // Set the data in Firestore
    await db.doc(documentPath).set(sampleDocData);

    // Prepare the update using the helper function (assuming this is how you're setting up your other tests)
    await db.doc(documentPath).set(sampleDocData);

    // Check against the expected schema
    await verifySchema(documentPath, {
      nullableField: {
        type: "null", // null is a type of object in JavaScript
        value: null,
      },
    });
  }, 12000);
});

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
import * as fft from "firebase-functions-test";
import {
  translateMultiple,
  translateMultipleBackfill,
} from "../../src/translate/translateMultiple";
import { updateTranslations } from "../../src/translate/common";

const languages = ["en", "es", "fr"];

const expectedMockArrayTranslations = {
  "0": {
    en: 'mock translated string "hello" in en',
    es: 'mock translated string "hello" in es',
    fr: 'mock translated string "hello" in fr',
  },
  "1": {
    en: 'mock translated string "how are you?" in en',
    es: 'mock translated string "how are you?" in es',
    fr: 'mock translated string "how are you?" in fr',
  },
};

const expectedMockObjectTranslations = {
  test0: {
    en: 'mock translated string "hello" in en',
    es: 'mock translated string "hello" in es',
    fr: 'mock translated string "hello" in fr',
  },
  test1: {
    en: 'mock translated string "how are you?" in en',
    es: 'mock translated string "how are you?" in es',
    fr: 'mock translated string "how are you?" in fr',
  },
};

jest.mock("../../src/config", () => ({
  default: {
    languages: ["en", "es", "fr"],
    outputFieldName: "translations",
  },
}));

const testFft = fft();

jest.mock("../../src/translate/common", () => ({
  ...jest.requireActual("../../src/translate/common"),
  updateTranslations: jest.fn().mockImplementation((snap, translations) => {}),
  translateString: jest.fn().mockImplementation((string, language) => {
    return Promise.resolve(
      `mock translated string \"${string}\" in ${language}`
    );
  }),
}));

const mockBulkWriterUpdate = jest.fn().mockImplementation((args) => {});

describe("translateMultipleBackfill", () => {
  // Setup common variables if needed
  let input;
  let snapshot;
  let bulkWriter = {
    update: mockBulkWriterUpdate,
  } as unknown as admin.firestore.BulkWriter;

  beforeEach(() => {
    // Reset mocks and setup common test variables
    jest.clearAllMocks();
  });

  test("should handle array input correctly", async () => {
    input = ["hello", "how are you?"];

    snapshot = testFft.firestore.makeDocumentSnapshot(
      { foo: "bar" },
      "document/path"
    );

    await translateMultipleBackfill(input, snapshot, bulkWriter);

    expect(bulkWriter.update).toBeCalledWith(
      snapshot.ref,
      "translations",
      expectedMockArrayTranslations
    );
  });

  test("should handle object input correctly", async () => {
    input = {
      test0: "hello",
      test1: "how are you?",
    };

    snapshot = testFft.firestore.makeDocumentSnapshot(
      { foo: "bar" },
      "document/path"
    );

    await translateMultipleBackfill(input, snapshot, bulkWriter);

    expect(bulkWriter.update).toBeCalledWith(
      snapshot.ref,
      "translations",
      expectedMockObjectTranslations
    );
  });
  // Add more test cases for different scenarios
});

describe("translateMultiple", () => {
  // Setup common variables if needed
  let input;
  let snapshot;
  let bulkWriter = {
    update: mockBulkWriterUpdate,
  } as unknown as admin.firestore.BulkWriter;

  beforeEach(() => {
    // Reset mocks and setup common test variables
    jest.clearAllMocks();
  });

  test("should handle array input correctly", async () => {
    input = ["hello", "how are you?"];

    snapshot = testFft.firestore.makeDocumentSnapshot(
      { foo: "bar" },
      "document/path"
    );

    await translateMultiple(input, languages, snapshot);

    expect(updateTranslations).toBeCalledWith(
      snapshot,
      expectedMockArrayTranslations
    );
  });
  test("should handle object input correctly", async () => {
    input = {
      test0: "hello",
      test1: "how are you?",
    };

    snapshot = testFft.firestore.makeDocumentSnapshot(
      { foo: "bar" },
      "document/path"
    );

    await translateMultiple(input, languages, snapshot);

    expect(updateTranslations).toBeCalledWith(
      snapshot,
      expectedMockObjectTranslations
    );
  });
  // Add more test cases for different scenarios
});

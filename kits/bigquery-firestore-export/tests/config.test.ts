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

import { Expression } from "firebase-functions/params";
import type { SelectInput, TextInput } from "firebase-functions/params";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CONFIG_EXPRESSIONS, configFromEnv, params } from "../src/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CONFIG_EXPRESSIONS", () => {
  test("namespaces the Pub/Sub topic with the required instance id", () => {
    expect(CONFIG_EXPRESSIONS.pubSubTopic).toBeInstanceOf(Expression);
    expect((CONFIG_EXPRESSIONS.pubSubTopic as Expression<string>).toCEL()).toBe(
      "kit-{{ params.INSTANCE_ID }}-processMessages"
    );
  });
});

describe("configFromEnv", () => {
  test("reads runtime parameters and derives the same topic", () => {
    vi.stubEnv(
      "FIREBASE_CONFIG",
      JSON.stringify({ projectId: "test-project" })
    );
    vi.stubEnv("INSTANCE_ID", "users-export");
    vi.stubEnv("BIGQUERY_DATASET_LOCATION", "EU");
    vi.stubEnv("DATASET_ID", "analytics");
    vi.stubEnv("TABLE_NAME", "users");
    vi.stubEnv("QUERY_STRING", "SELECT * FROM source.users");
    vi.stubEnv("DISPLAY_NAME", "Users export");
    vi.stubEnv("SCHEDULE", "every 24 hours");
    vi.stubEnv("COLLECTION_PATH", "transferConfigs");
    vi.stubEnv("LOG_LEVEL", "info");

    expect(configFromEnv()).toEqual({
      projectId: "test-project",
      instanceId: "users-export",
      bigqueryDatasetLocation: "EU",
      datasetId: "analytics",
      tableName: "users",
      queryString: "SELECT * FROM source.users",
      displayName: "Users export",
      schedule: "every 24 hours",
      transferConfigName: undefined,
      partitioningField: undefined,
      pubSubTopic: "kit-users-export-processMessages",
      firestoreCollection: "transferConfigs",
      logLevel: "info",
    });
  });
});

const EXPECTED_DATASET_LOCATIONS = [
  "us-east5",
  "us-central1",
  "us-west4",
  "us-west2",
  "northamerica-northeast1",
  "us-east4",
  "us-west1",
  "us-west3",
  "southamerica-east1",
  "southamerica-west1",
  "us-east1",
  "northamerica-northeast2",
  "asia-south2",
  "asia-east2",
  "asia-southeast2",
  "australia-southeast2",
  "asia-south1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-southeast1",
  "australia-southeast1",
  "asia-east1",
  "asia-northeast1",
  "europe-west1",
  "europe-north1",
  "europe-west3",
  "europe-west2",
  "europe-southwest1",
  "europe-west8",
  "europe-west4",
  "europe-west9",
  "europe-central2",
  "europe-west6",
  "US",
  "EU",
];

describe("COLLECTION_PATH input", () => {
  const input = params.firestoreCollection.options.input as TextInput<string>;

  test("declares the collection path validator and its error message", () => {
    expect(input.text.validationRegex).toEqual(/^[^\/]+(\/[^\/]+\/[^\/]+)*$/);
    expect(input.text.validationErrorMessage).toBe(
      "Must be a valid Cloud Firestore Collection"
    );
    expect(params.firestoreCollection.options.default).toBe("transferConfigs");
  });

  test.each([
    ["transferConfigs", true],
    ["a", true],
    ["a/b/c", true],
    ["a/b/c/d/e", true],
    ["a/b", false],
    ["a/b/c/d", false],
    ["/a", false],
    ["a/", false],
    ["", false],
  ])("%s is accepted: %s", (path, accepted) => {
    const regex = new RegExp(input.text.validationRegex!);
    expect(regex.test(path)).toBe(accepted);
  });
});

describe("BIGQUERY_DATASET_LOCATION input", () => {
  const input = params.bigqueryDatasetLocation.options
    .input as SelectInput<string>;

  test("offers the upstream regions and both multi-regions", () => {
    expect(input.select.options.map((option) => option.value)).toEqual(
      EXPECTED_DATASET_LOCATIONS
    );
    expect(params.bigqueryDatasetLocation.options.default).toBe("US");
  });

  test("labels every option", () => {
    for (const option of input.select.options) {
      expect(option.label).toMatch(new RegExp(`\\(${option.value}\\)$`));
    }
  });
});

describe("params without upstream validation", () => {
  test.each([
    "datasetId",
    "tableName",
    "queryString",
    "displayName",
    "schedule",
  ] as const)("%s stays free-form", (key) => {
    expect(params[key].options.input).toBeUndefined();
  });
});

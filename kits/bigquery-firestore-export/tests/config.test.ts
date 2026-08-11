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
import { afterEach, describe, expect, test, vi } from "vitest";
import { CONFIG_EXPRESSIONS, configFromEnv } from "../src/config";

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

    expect(configFromEnv()).toMatchObject({
      projectId: "test-project",
      instanceId: "users-export",
      bigqueryDatasetLocation: "EU",
      datasetId: "analytics",
      tableName: "users",
      pubSubTopic: "kit-users-export-processMessages",
      firestoreCollection: "transferConfigs",
      logLevel: "info",
    });
  });
});

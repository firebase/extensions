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
  test("binds the trigger to the Pub/Sub topic parameter", () => {
    expect(CONFIG_EXPRESSIONS.pubSubTopic).toBeInstanceOf(Expression);
    expect((CONFIG_EXPRESSIONS.pubSubTopic as Expression<string>).toCEL()).toBe(
      "{{ params.PUB_SUB_TOPIC }}"
    );
  });

  test("defaults the topic parameter to the instance-namespaced kit topic", () => {
    const spec = (
      CONFIG_EXPRESSIONS.pubSubTopic as unknown as {
        toSpec: () => { default?: string };
      }
    ).toSpec();
    expect(spec.default).toBe("kit-{{ params.INSTANCE_ID }}-processMessages");
  });

  test("accepts a topic ID but rejects a full resource name", () => {
    const spec = (
      CONFIG_EXPRESSIONS.pubSubTopic as unknown as {
        toSpec: () => { input?: { text?: { validationRegex?: string } } };
      }
    ).toSpec();
    const pattern = spec.input?.text?.validationRegex;
    expect(pattern).toBeTypeOf("string");
    const validate = (value: string) =>
      new RegExp(pattern as string).test(value);

    expect(validate("ext-users-export-processMessages")).toBe(true);
    expect(validate("kit-users-export-processMessages")).toBe(true);
    expect(
      validate("projects/test-project/topics/ext-users-export-processMessages")
    ).toBe(false);
    expect(validate("")).toBe(false);
    expect(validate("goog-reserved-prefix")).toBe(false);
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

    vi.stubEnv("PUB_SUB_TOPIC", "kit-users-export-processMessages");

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

  test("passes through a topic pointing at the extension's own topic", () => {
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
    vi.stubEnv("PUB_SUB_TOPIC", "ext-users-export-processMessages");

    expect(configFromEnv().pubSubTopic).toBe(
      "ext-users-export-processMessages"
    );
  });
});

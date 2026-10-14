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

import { declaredParams, Expression } from "firebase-functions/params";
import { afterEach, describe, expect, test, vi } from "vitest";

const INSTANCE_ID = "users-export";

// The instance id is read when the module loads, so the environment has to be
// in place before each import.
async function importConfig(instanceId: string | undefined) {
  vi.resetModules();
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", instanceId);
  return import("../src/config");
}

function stubRuntimeEnv() {
  vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: "test-project" }));
  vi.stubEnv("BIGQUERY_DATASET_LOCATION", "EU");
  vi.stubEnv("DATASET_ID", "analytics");
  vi.stubEnv("TABLE_NAME", "users");
  vi.stubEnv("QUERY_STRING", "SELECT * FROM source.users");
  vi.stubEnv("DISPLAY_NAME", "Users export");
  vi.stubEnv("SCHEDULE", "every 24 hours");
  vi.stubEnv("COLLECTION_PATH", "transferConfigs");
  vi.stubEnv("LOG_LEVEL", "info");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CONFIG_EXPRESSIONS", () => {
  test("binds the trigger to the Pub/Sub topic parameter", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig(INSTANCE_ID);

    expect(CONFIG_EXPRESSIONS.pubSubTopic).toBeInstanceOf(Expression);
    expect((CONFIG_EXPRESSIONS.pubSubTopic as Expression<string>).toCEL()).toBe(
      "{{ params.PUB_SUB_TOPIC }}"
    );
  });

  test("defaults the topic parameter to the instance-namespaced kit topic", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig(INSTANCE_ID);

    const spec = (
      CONFIG_EXPRESSIONS.pubSubTopic as unknown as {
        toSpec: () => { default?: string };
      }
    ).toSpec();
    expect(spec.default).toBe("kit-users-export-processMessages");
  });

  test("accepts a topic ID but rejects a full resource name", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig(INSTANCE_ID);

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

describe("instance id", () => {
  // The CLI injects FIREBASE_KIT_INSTANCE_ID as a reserved env var; declaring
  // it (or INSTANCE_ID) as a param makes the CLI prompt for a value it cannot
  // accept and abort loading the kit.
  test("is not declared as a param", async () => {
    await importConfig(INSTANCE_ID);

    const declared = declaredParams.map((param) => param.name);
    expect(declared).toContain("PUB_SUB_TOPIC");
    expect(declared).not.toContain("INSTANCE_ID");
    expect(declared).not.toContain("FIREBASE_KIT_INSTANCE_ID");
  });

  test("fails discovery when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    await expect(importConfig(undefined)).rejects.toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });

  test("throws at runtime when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    const { configFromEnv } = await importConfig(INSTANCE_ID);
    stubRuntimeEnv();
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

    expect(() => configFromEnv()).toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });
});

describe("declared params", () => {
  test("does not declare a transfer config name param", async () => {
    await importConfig(INSTANCE_ID);

    const declared = declaredParams.map((param) => param.name);
    expect(declared).not.toContain("TRANSFER_CONFIG_NAME");
  });
});

describe("configFromEnv", () => {
  test("reads runtime parameters and derives the same topic", async () => {
    const { configFromEnv } = await importConfig(INSTANCE_ID);
    stubRuntimeEnv();
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

  test("passes through a topic pointing at the extension's own topic", async () => {
    const { configFromEnv } = await importConfig(INSTANCE_ID);
    stubRuntimeEnv();
    vi.stubEnv("PUB_SUB_TOPIC", "ext-users-export-processMessages");

    expect(configFromEnv().pubSubTopic).toBe(
      "ext-users-export-processMessages"
    );
  });
});

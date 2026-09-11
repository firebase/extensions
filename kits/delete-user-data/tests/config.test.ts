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

import { afterEach, describe, expect, test, vi } from "vitest";

class FakeExpression<_T = string> {
  constructor(private readonly cel: string) {}

  toCEL(): string {
    return this.cel;
  }
}

class FakeStringParam extends FakeExpression<string> {
  constructor(
    private readonly name: string,
    private readonly defaultValue?: string | FakeExpression
  ) {
    super(`{{ params.${name} }}`);
  }

  value(): string {
    if (process.env[this.name] !== undefined) {
      return process.env[this.name];
    }
    if (this.defaultValue instanceof FakeStringParam) {
      return this.defaultValue.value();
    }
    if (this.defaultValue instanceof FakeExpression) {
      return this.defaultValue.toCEL();
    }
    return this.defaultValue ?? `${this.name.toLowerCase()}-value`;
  }
}

const defineString = vi.fn(
  (name: string, opts?: { default?: string | FakeExpression }) =>
    new FakeStringParam(name, opts?.default)
);

// Carries name so configFromEnv can look the variable up, as the real one does.
const defineInt = vi.fn((name: string, opts?: { default?: number }) => ({
  name,
  value: () => opts?.default ?? 0,
}));

const select = vi.fn((options: Record<string, string>) => ({
  select: {
    options: Object.entries(options).map(([label, value]) => ({
      label,
      value,
    })),
  },
}));

function cel(value: unknown): string {
  return value instanceof FakeExpression ? value.toCEL() : String(value);
}

vi.mock("firebase-functions/params", () => ({
  Expression: FakeExpression,
  defineInt,
  defineString,
  projectID: { value: () => "demo-test" },
  select,
  storageBucket: new FakeStringParam("STORAGE_BUCKET", "demo-test.appspot.com"),
}));

async function importConfig() {
  vi.resetModules();
  defineString.mockClear();
  defineInt.mockClear();
  select.mockClear();
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", "test-instance");

  return import("../src/config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configFromEnv", () => {
  test("reads the extension.yaml defaults", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv()).toMatchObject({
      firestoreDatabaseId: "(default)",
      firestoreDeleteMode: "shallow",
      rtdbLocation: "us-central1",
      enableAutoDiscovery: false,
      searchFields: "id,uid,userId",
      projectId: "demo-test",
    });
  });

  test("maps empty params to undefined", async () => {
    const { configFromEnv } = await importConfig();
    const config = configFromEnv();

    expect(config.firestorePaths).toBeUndefined();
    expect(config.rtdbPaths).toBeUndefined();
    expect(config.storagePaths).toBeUndefined();
    expect(config.searchFunction).toBeUndefined();
    expect(config.rtdbInstance).toBeUndefined();
    expect(config.searchDepth).toBeUndefined();
  });

  test("parses the predecessor's yes/no values", async () => {
    const { configFromEnv } = await importConfig();

    vi.stubEnv("ENABLE_AUTO_DISCOVERY", "yes");
    expect(configFromEnv().enableAutoDiscovery).toBe(true);

    vi.stubEnv("ENABLE_AUTO_DISCOVERY", "no");
    expect(configFromEnv().enableAutoDiscovery).toBe(false);
  });

  test("declares the params the extension exposes", async () => {
    await importConfig();

    const declared = defineString.mock.calls.map(([name]) => name);
    expect(declared).toEqual(
      expect.arrayContaining([
        "FIRESTORE_PATHS",
        "FIRESTORE_DATABASE_ID",
        "FIRESTORE_DELETE_MODE",
        "SELECTED_DATABASE_INSTANCE",
        "SELECTED_DATABASE_LOCATION",
        "RTDB_PATHS",
        "CLOUD_STORAGE_BUCKET",
        "STORAGE_PATHS",
        "AUTO_DISCOVERY_SEARCH_FIELDS",
        "SEARCH_FUNCTION",
        "DISCOVERY_TOPIC_NAME",
        "DELETION_TOPIC_NAME",
      ])
    );
    expect(defineInt.mock.calls).toContainEqual([
      "AUTO_DISCOVERY_SEARCH_DEPTH",
      expect.objectContaining({ default: 3 }),
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "ENABLE_AUTO_DISCOVERY",
      expect.objectContaining({
        default: "no",
        input: {
          select: {
            options: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
          },
        },
      }),
    ]);
  });

  // The CLI injects FIREBASE_KIT_INSTANCE_ID as a reserved env var; declaring
  // it (or INSTANCE_ID) as a param makes the CLI prompt for a value it cannot
  // accept and abort loading the kit.
  test("does not declare an instance-id param", async () => {
    await importConfig();

    const declared = defineString.mock.calls.map(([name]) => name);
    expect(declared).not.toContain("INSTANCE_ID");
    expect(declared).not.toContain("FIREBASE_KIT_INSTANCE_ID");
  });

  test("reads the instance id from the injected environment", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv().instanceId).toBe("test-instance");
  });

  test("throws when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    const { configFromEnv } = await importConfig();
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

    expect(() => configFromEnv()).toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });

  test("defaults the topic names to kit-{instanceId}-*", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    expect(cel(CONFIG_EXPRESSIONS.discoveryTopicName)).toBe(
      "{{ params.DISCOVERY_TOPIC_NAME }}"
    );
    expect(cel(CONFIG_EXPRESSIONS.deletionTopicName)).toBe(
      "{{ params.DELETION_TOPIC_NAME }}"
    );
    expect(defineString.mock.calls).toContainEqual([
      "DISCOVERY_TOPIC_NAME",
      { default: "kit-test-instance-discovery" },
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "DELETION_TOPIC_NAME",
      { default: "kit-test-instance-deletion" },
    ]);
  });

  test("defaults the storage bucket to the project bucket param", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv().storageBucket).toBe("demo-test.appspot.com");
  });
});

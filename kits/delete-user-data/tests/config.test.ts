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

const defineBoolean = vi.fn((_name: string, opts?: { default?: boolean }) => ({
  value: () => opts?.default ?? false,
}));

const expr = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    new FakeExpression(
      strings.reduce(
        (result, part, index) =>
          result + part + (index < values.length ? cel(values[index]) : ""),
        ""
      )
    )
);

function cel(value: unknown): string {
  return value instanceof FakeExpression ? value.toCEL() : String(value);
}

vi.mock("firebase-functions/params", () => ({
  Expression: FakeExpression,
  defineBoolean,
  defineInt,
  defineString,
  expr,
  projectID: { value: () => "demo-test" },
  select: vi.fn((options: string[]) => ({ options })),
  storageBucket: new FakeStringParam("STORAGE_BUCKET", "demo-test.appspot.com"),
}));

async function importConfig() {
  vi.resetModules();
  defineString.mockClear();
  defineInt.mockClear();
  defineBoolean.mockClear();
  expr.mockClear();

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

  test("declares the params the extension exposes", async () => {
    await importConfig();

    const declared = defineString.mock.calls.map(([name]) => name);
    expect(declared).toEqual(
      expect.arrayContaining([
        "INSTANCE_ID",
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
    expect(defineBoolean.mock.calls).toContainEqual([
      "ENABLE_AUTO_DISCOVERY",
      expect.objectContaining({ default: false }),
    ]);
  });

  test("defaults the topic names to kit-{instanceId}-* expressions", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    expect(cel(CONFIG_EXPRESSIONS.discoveryTopicName)).toBe(
      "{{ params.DISCOVERY_TOPIC_NAME }}"
    );
    expect(cel(CONFIG_EXPRESSIONS.deletionTopicName)).toBe(
      "{{ params.DELETION_TOPIC_NAME }}"
    );
    expect(expr.mock.results.map((result) => cel(result.value))).toEqual([
      "kit-{{ params.INSTANCE_ID }}-discovery",
      "kit-{{ params.INSTANCE_ID }}-deletion",
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "DISCOVERY_TOPIC_NAME",
      { default: expect.anything() },
    ]);
  });

  test("defaults the storage bucket to the project bucket param", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv().storageBucket).toBe("demo-test.appspot.com");
  });
});

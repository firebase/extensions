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
    private readonly defaultValue?: string
  ) {
    super(`{{ params.${name} }}`);
  }

  value(): string {
    return this.defaultValue ?? `${this.name.toLowerCase()}-value`;
  }
}

const defineString = vi.fn(
  (name: string, opts?: { default?: string; input?: unknown }) =>
    new FakeStringParam(name, opts?.default)
);

const defineInt = vi.fn(
  (_name: string, opts?: { default?: number; input?: unknown }) => ({
    value: () => opts?.default ?? 10,
  })
);

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
  defineString,
  defineInt,
  expr,
}));

async function importConfig() {
  vi.resetModules();
  defineString.mockClear();
  defineInt.mockClear();
  expr.mockClear();

  return import("../src/config");
}

afterEach(() => {
  delete process.env.DATABASE_INSTANCE;
});

describe("configFromEnv", () => {
  test("reads an explicit SELECTED_DATABASE_INSTANCE param", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv()).toMatchObject({
      nodePath: "rtdb_node_path-value",
      maxCount: 10,
      databaseInstance: "selected_database_instance-value",
    });
    const instanceOptions = defineString.mock.calls.find(
      ([name]) => name === "SELECTED_DATABASE_INSTANCE"
    )?.[1];
    expect(instanceOptions).not.toHaveProperty("default");
    expect(instanceOptions).toMatchObject({
      input: { text: { validationRegex: /^([0-9a-z_.-]*)$/ } },
    });
  });

  // The extension declared NODE_PATH and MAX_COUNT as required with no default,
  // so the CLI prompted for both at install. Declaring a default here would let
  // a deploy that omits MAX_COUNT silently prune every node down to that value.
  test("declares no default for RTDB_NODE_PATH or MAX_COUNT", async () => {
    await importConfig();

    const nodePathOptions = defineString.mock.calls.find(
      ([name]) => name === "RTDB_NODE_PATH"
    )?.[1];
    const maxCountOptions = defineInt.mock.calls.find(
      ([name]) => name === "MAX_COUNT"
    )?.[1];

    expect(nodePathOptions).not.toHaveProperty("default");
    expect(maxCountOptions).not.toHaveProperty("default");
    expect(nodePathOptions).toMatchObject({
      input: { text: { validationRegex: /^\S+$/ } },
    });
    expect(maxCountOptions).toMatchObject({
      input: { text: { validationRegex: /^\d+$/ } },
    });
  });
});

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
  (name: string, opts?: { default?: string }) =>
    new FakeStringParam(name, opts?.default)
);

const defineInt = vi.fn((_name: string, opts?: { default?: number }) => ({
  value: () => opts?.default ?? 10,
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
      nodePath: "node_path-value",
      maxCount: 10,
      databaseInstance: "selected_database_instance-value",
      region: "us-central1",
    });
    expect(defineString.mock.calls).toContainEqual([
      "SELECTED_DATABASE_INSTANCE",
    ]);
  });
});

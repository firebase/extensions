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

import { describe, expect, test, vi } from "vitest";

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
  expr,
}));

async function importConfig() {
  vi.resetModules();
  defineString.mockClear();
  expr.mockClear();

  return import("../src/config");
}

describe("configFromEnv", () => {
  test("reads the documented params and defaults", async () => {
    const { configFromEnv } = await importConfig();

    expect(configFromEnv()).toEqual({
      internalStatePath: "_firebase_ext_/sharded_counter",
      scheduleFrequencyMinutes: 1,
    });
    expect(defineString.mock.calls).toContainEqual([
      "INTERNAL_STATE_PATH",
      { default: "_firebase_ext_/sharded_counter" },
    ]);
    expect(defineString.mock.calls).toContainEqual([
      "SCHEDULE_FREQUENCY",
      { default: "1" },
    ]);
  });

  test("coerces the schedule frequency to a number", async () => {
    const { configFromEnv } = await importConfig();

    expect(typeof configFromEnv().scheduleFrequencyMinutes).toBe("number");
  });
});

describe("CONFIG_EXPRESSIONS", () => {
  test("keeps the internal state path as a param expression", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    expect(cel(CONFIG_EXPRESSIONS.internalStatePath)).toBe(
      "{{ params.INTERNAL_STATE_PATH }}"
    );
  });

  test("builds the schedule from the frequency param", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    expect(cel(CONFIG_EXPRESSIONS.schedule)).toBe(
      "every {{ params.SCHEDULE_FREQUENCY }} minutes"
    );
  });

  test("no deploy-time expression resolves to an empty or undefined literal", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig();

    for (const expression of Object.values(CONFIG_EXPRESSIONS)) {
      expect(cel(expression)).not.toBe("");
      expect(cel(expression)).not.toContain("undefined");
    }
  });
});

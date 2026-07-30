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

class Expression<_T = string> {
  constructor(private readonly cel: string) {}

  toCEL(): string {
    return this.cel;
  }
}

class StringParam extends Expression<string> {
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
    new StringParam(name, opts?.default)
);

const defineInt = vi.fn((_name: string, opts?: { default?: number }) => ({
  value: () => opts?.default ?? 10,
}));

function cel(value: unknown): string {
  return value instanceof Expression ? value.toCEL() : String(value);
}

vi.mock("firebase-functions/params", () => ({
  Expression,
  defineString,
  defineInt,
}));

describe("envDeployOptions", () => {
  test("resolves RTDB trigger options to strings", async () => {
    vi.resetModules();
    const { envDeployOptions } = await import("../src/config");

    const options = envDeployOptions();

    expect(options.ref).toBe("node_path-value/{nodeId}");
    expect(options.instance).toBe("selected_database_instance-value");
    expect(options.region).toBe("us-central1");
  });

  test("does not freeze undefined or empty literals into deploy options", async () => {
    vi.resetModules();
    const { envDeployOptions } = await import("../src/config");

    const options = envDeployOptions();
    const values = [
      cel(options.ref),
      cel(options.instance),
      cel(options.region),
    ];

    for (const value of values) {
      expect(value).not.toContain("undefined");
      expect(value).not.toContain('""');
      expect(value).not.toBe("");
    }
  });
});

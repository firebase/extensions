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

import { Expression } from "firebase-functions/params";
import { describe, expect, test } from "vitest";

import { envDeployOptions } from "../src/config";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("envDeployOptions", () => {
  const options = envDeployOptions();

  test("ref is a concrete string (RTDB SDK requires normalizePath)", () => {
    expect(typeof options.ref).toBe("string");
    expect(options.ref).toMatch(/\/\{nodeId\}$/);
    expect(options.ref).not.toBe("/{nodeId}");
    expect(options.ref).not.toBe("{nodeId}");
  });

  test("instance is a param expression", () => {
    expect(options.instance).toBeInstanceOf(Expression);
    expect(cel(options.instance)).toBe(
      "{{ params.SELECTED_DATABASE_INSTANCE }}"
    );
  });

  test("does not set a function region", () => {
    expect(options).not.toHaveProperty("region");
  });

  test("no deploy-time option is a frozen undefined/empty literal", () => {
    expect(options.ref).not.toBe("");
    expect(cel(options.instance)).not.toBe("");
    expect(cel(options.instance)).not.toContain("undefined");
  });
});

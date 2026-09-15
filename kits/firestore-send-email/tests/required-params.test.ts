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
import { assertRequiredParams } from "../src/config";

const REQUIRED = [
  "DATABASE",
  "AUTH_TYPE",
  "MAIL_COLLECTION",
  "DEFAULT_FROM",
  "TTL_EXPIRE_TYPE",
  "TTL_EXPIRE_VALUE",
];

const OPTIONAL = [
  "DATABASE_REGION",
  "SMTP_CONNECTION_URI",
  "SMTP_PASSWORD",
  "HOST",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertRequiredParams", () => {
  test("passes when no params have been supplied yet", () => {
    expect(() => assertRequiredParams()).not.toThrow();
  });

  test("passes when every required param holds a value", () => {
    for (const name of REQUIRED) {
      vi.stubEnv(name, "set");
    }

    expect(() => assertRequiredParams()).not.toThrow();
  });

  test("rejects required params blanked in .env, naming each one", () => {
    for (const name of REQUIRED) {
      vi.stubEnv(name, "");
    }

    expect(() => assertRequiredParams()).toThrow(REQUIRED.join(", "));
  });

  test("rejects a whitespace-only value, which the CLI prompt accepts", () => {
    vi.stubEnv(REQUIRED[0], "   ");

    expect(() => assertRequiredParams()).toThrow(REQUIRED[0]);
  });

  test("ignores optional params left blank", () => {
    for (const name of OPTIONAL) {
      vi.stubEnv(name, "");
    }

    expect(() => assertRequiredParams()).not.toThrow();
  });
});

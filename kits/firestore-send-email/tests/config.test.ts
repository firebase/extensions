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

vi.mock("firebase-functions/params", () => ({
  defineString: (_name: string, opts?: { default?: string }) => ({
    value: () => opts?.default ?? "",
  }),
  defineInt: (_name: string, opts?: { default?: number }) => ({
    value: () => opts?.default ?? 0,
  }),
  defineBoolean: (_name: string, opts?: { default?: boolean }) => ({
    value: () => opts?.default ?? false,
  }),
  defineSecret: (name: string) => ({
    name,
    value: () => "secret-value",
  }),
  select: (options: unknown) => ({ select: { options } }),
  expr: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    toCEL: () =>
      strings.reduce(
        (result, segment, index) =>
          result +
          segment +
          (index < values.length ? String(values[index]) : ""),
        ""
      ),
  }),
}));

import { configFromEnv, secretParamsForAuthType } from "../src/config";
import { resolveConfig } from "../src/export-config";
import { AuthenticatonType } from "../src/types";

describe("configFromEnv", () => {
  test("maps params and keeps secret-backed values deferred", () => {
    const config = configFromEnv();
    expect(config.mailCollection).toBe("mail");
    expect(config.databaseId).toBe("(default)");
    expect(config.defaultReplyTo).toBe("");
    expect(typeof config.smtpPassword).toBe("object");
    expect(config.clientId).toBeUndefined();
  });
});

describe("secretParamsForAuthType", () => {
  test("binds only the SMTP password secret for username/password auth", () => {
    expect(
      secretParamsForAuthType(AuthenticatonType.UsernamePassword).map(
        (secret) => (secret as { name: string }).name
      )
    ).toEqual(["SMTP_PASSWORD"]);
  });

  test("binds only OAuth secrets for OAuth2 auth", () => {
    expect(
      secretParamsForAuthType(AuthenticatonType.OAuth2).map(
        (secret) => (secret as { name: string }).name
      )
    ).toEqual(["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"]);
  });

  test("uses username/password secret binding by default", () => {
    expect(
      secretParamsForAuthType().map(
        (secret) => (secret as { name: string }).name
      )
    ).toEqual(["SMTP_PASSWORD"]);
  });

  test("rejects unsupported auth types", () => {
    expect(() => secretParamsForAuthType("Unknown")).toThrow(
      "Unsupported AUTH_TYPE for firestore-send-email: Unknown"
    );
  });
});

describe("resolveConfig", () => {
  test("normalizes optional strings and resolves secrets", () => {
    const resolved = resolveConfig({
      databaseRegion: "us-central1",
      mailCollection: "mail",
      defaultFrom: "sender@example.com",
      smtpPassword: { value: () => "pw" },
      clientId: { value: () => "client" },
      ttlExpireType: "day",
      ttlExpireValue: 3,
    });

    expect(resolved.smtpPassword).toBe("pw");
    expect(resolved.clientId).toBe("client");
    expect(resolved.ttlExpireType).toBe("day");
    expect(resolved.ttlExpireValue).toBe(3);
  });
});

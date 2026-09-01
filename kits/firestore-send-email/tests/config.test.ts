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

interface StringParamOpts {
  default?: string;
  input?: { text?: { validationRegex?: RegExp } };
}

const { stringParamOpts } = vi.hoisted(() => ({
  stringParamOpts: new Map<string, StringParamOpts | undefined>(),
}));

vi.mock("firebase-functions/params", () => ({
  defineString: (name: string, opts?: StringParamOpts) => {
    stringParamOpts.set(name, opts);
    return {
      value: () => opts?.default ?? "",
    };
  },
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

describe("SMTP_CONNECTION_URI validationRegex", () => {
  function connectionUriRegex(): RegExp {
    const regex = stringParamOpts.get("SMTP_CONNECTION_URI")?.input?.text
      ?.validationRegex;
    if (!regex) {
      throw new Error("SMTP_CONNECTION_URI declares no validationRegex");
    }
    return regex;
  }

  test("accepts the documented URI forms and a blank value", () => {
    for (const uri of [
      "smtps://username@smtp.hostname.com:465",
      "smtps://smtp.gmail.com:465",
      "smtps://username@gmail.com:password@smtp.gmail.com:465",
      "smtp://smtp.gmail.com:587?pool=true",
      "",
    ]) {
      expect(connectionUriRegex().test(uri)).toBe(true);
    }
  });

  test("rejects a URI without a scheme or without a port", () => {
    expect(connectionUriRegex().test("smtp.gmail.com:465")).toBe(false);
    expect(connectionUriRegex().test("smtp://smtp.gmail.com")).toBe(false);
  });

  test("accepts trailing garbage after a valid prefix because the first alternative is unanchored", () => {
    for (const uri of [
      "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3:smtp.gmail.com:465?pool=true&service=gmail",
      "smtps://smtp.gmail.com:465 and then total garbage",
    ]) {
      expect(connectionUriRegex().test(uri)).toBe(true);
    }
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

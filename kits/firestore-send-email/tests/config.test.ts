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

interface StringParamOpts {
  default?: string;
  input?: { text?: { validationRegex?: RegExp } };
}

const { stringParamOpts, paramEnv } = vi.hoisted(() => ({
  stringParamOpts: new Map<string, StringParamOpts | undefined>(),
  paramEnv: new Map<string, string>(),
}));

vi.mock("firebase-functions/params", () => ({
  // Values come from paramEnv rather than process.env: AUTH_TYPE, USER and
  // HOST are all real param names that collide with ambient shell vars, which
  // would otherwise make results machine-dependent.
  defineString: (name: string, opts?: StringParamOpts) => {
    stringParamOpts.set(name, opts);
    return {
      value: () => paramEnv.get(name) ?? opts?.default ?? "",
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
  afterEach(() => {
    paramEnv.clear();
  });

  test("maps params and keeps secret-backed values deferred", () => {
    const config = configFromEnv();
    expect(config.mailCollection).toBe("mail");
    expect(config.databaseId).toBe("(default)");
    expect(config.defaultReplyTo).toBe("");
    expect(typeof config.smtpPassword).toBe("object");
    expect(config.clientId).toBeUndefined();
  });

  test("keeps the SMTP password for OAuth2 so SendGrid can use it as API key", () => {
    paramEnv.set("AUTH_TYPE", AuthenticatonType.OAuth2);
    const config = configFromEnv();
    expect(config.authType).toBe(AuthenticatonType.OAuth2);
    expect(typeof config.smtpPassword).toBe("object");
    expect(typeof config.clientId).toBe("object");
    expect(typeof config.clientSecret).toBe("object");
    expect(typeof config.refreshToken).toBe("object");
  });
});

describe("configFromEnv TESTING", () => {
  const original = process.env.TESTING;

  afterEach(() => {
    if (original === undefined) delete process.env.TESTING;
    else process.env.TESTING = original;
  });

  test('enables testing mode when TESTING is "true"', () => {
    process.env.TESTING = "true";
    expect(configFromEnv().testing).toBe(true);
    expect(resolveConfig(configFromEnv()).testing).toBe(true);
  });

  test("leaves testing mode off when TESTING is unset", () => {
    delete process.env.TESTING;
    expect(configFromEnv().testing).toBe(false);
    expect(resolveConfig(configFromEnv()).testing).toBe(false);
  });

  test('only the exact string "true" enables testing mode', () => {
    for (const value of ["TRUE", "1", "yes", ""]) {
      process.env.TESTING = value;
      expect(configFromEnv().testing).toBe(false);
    }
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

  test("keeps the SMTP password bound alongside OAuth secrets for OAuth2 auth", () => {
    expect(
      secretParamsForAuthType(AuthenticatonType.OAuth2).map(
        (secret) => (secret as { name: string }).name
      )
    ).toEqual(["SMTP_PASSWORD", "CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"]);
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
      // Password containing the separator characters the regex reasons about.
      "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3@smtp.gmail.com:465?pool=true&service=gmail",
      "",
    ]) {
      expect(connectionUriRegex().test(uri)).toBe(true);
    }
  });

  test("rejects a URI without a scheme or without a port", () => {
    expect(connectionUriRegex().test("smtp.gmail.com:465")).toBe(false);
    expect(connectionUriRegex().test("smtp://smtp.gmail.com")).toBe(false);
  });

  // #3067: the first alternative used to be unanchored, so anything following a
  // valid prefix was accepted. The legacy suite already asserted the first case
  // is invalid, but against an anchored copy of the regex that never shipped.
  test("rejects trailing text after an otherwise valid URI", () => {
    for (const uri of [
      "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3:smtp.gmail.com:465?pool=true&service=gmail",
      "smtps://smtp.gmail.com:465 and then total garbage",
    ]) {
      expect(connectionUriRegex().test(uri)).toBe(false);
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

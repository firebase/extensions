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

import { logger } from "firebase-functions";
import Mail from "nodemailer/lib/mailer";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ResolvedSendEmailConfig } from "../src/export-config";
import { isSendGrid, setSmtpCredentials } from "../src/helpers";
import { AuthenticatonType } from "../src/types";

const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

function makeConfig(
  overrides: Partial<ResolvedSendEmailConfig>
): ResolvedSendEmailConfig {
  return {
    databaseId: "(default)",
    databaseRegion: "us-central1",
    mailCollection: "mail",
    defaultFrom: "",
    testing: false,
    ttlExpireType: "never",
    ttlExpireValue: 1,
    tlsOptions: "{}",
    oauthSecure: true,
    authType: AuthenticatonType.UsernamePassword,
    ...overrides,
  };
}

describe("setSmtpCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("prefers the smtpPassword secret over the password in the URI", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpPassword: "fakepassword",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.pass).toBe("fakepassword");
    expect(credentials.options.secure).toBe(true);
  });

  test("falls back to the password embedded in the URI", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("secret-password");
    expect(credentials.options.secure).toBe(true);
  });

  test("accepts a URI with a username but no password", () => {
    const config = makeConfig({
      smtpConnectionUri: "smtps://fakeemail@gmail.com@smtp.gmail.com:465",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("");
    expect(credentials.options.secure).toBe(true);
  });

  test("accepts a URI with neither username nor password", () => {
    const config = makeConfig({
      smtpConnectionUri: "smtp://smtp.gmail.com:465",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth).toBe(undefined);
    expect(credentials.options.secure).toBe(false);
  });

  test("forwards query params from the URI to the transport options", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:secret-password@smtp.gmail.com:465?pool=true&service=gmail",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("secret-password");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");
  });

  test("percent-encodes special characters in the smtpPassword secret", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com@smtp.gmail.com:465?pool=true&service=gmail",
      smtpPassword: "4,h?dhuNTbv9zMrP4&7&7%*3",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("4,h?dhuNTbv9zMrP4&7&7%*3");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");
  });

  test("percent-encodes special characters in the URI password", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:4,hdhuNTbv9zMrP4&7&7%*3@smtp.gmail.com:465?pool=true&service=gmail",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("4,hdhuNTbv9zMrP4&7&7%*3");
    expect(credentials.options.secure).toBe(false);
    expect(credentials.options.pool).toBe(true);
    expect(credentials.options.service).toBe("gmail");
  });

  test("throws and warns when the URI cannot be parsed", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtp://fakeemail@gmail.com:4,h?dhuNTbv9zMrP4&7&7%*3@smtp.gmail.com:465?pool=true&service=gmail",
    });

    expect(() => setSmtpCredentials(config)).toThrow(Error);
    expect(warnSpy).toHaveBeenCalledWith(
      "Invalid URI: please reconfigure with a valid SMTP connection URI"
    );
  });

  test("builds an OAuth2 transport when the auth type is OAuth2", () => {
    const config = makeConfig({
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      host: "smtp.gmail.com",
      clientId: "fakeClientId",
      clientSecret: "fakeClientSecret",
      refreshToken: "test_refresh_token",
      oauthSecure: true,
      authType: AuthenticatonType.OAuth2,
      user: "test@test.com",
    });

    const credentials = setSmtpCredentials(config);

    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.secure).toBe(true);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.type).toBe("OAuth2");
    expect(credentials.options.auth.clientId).toBe("fakeClientId");
    expect(credentials.options.auth.clientSecret).toBe("fakeClientSecret");
    expect(credentials.options.auth.user).toBe("test@test.com");
    expect(credentials.options.auth.refreshToken).toBe("test_refresh_token");
  });
});

describe("isSendGrid", () => {
  test("returns true for a SendGrid SMTP URI", () => {
    expect(
      isSendGrid(
        makeConfig({
          smtpConnectionUri: "smtps://apikey@smtp.sendgrid.net:465",
          authType: AuthenticatonType.ApiKey,
        })
      )
    ).toBe(true);
  });

  test("returns false for a non-SendGrid SMTP URI", () => {
    expect(
      isSendGrid(
        makeConfig({
          smtpConnectionUri:
            "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
        })
      )
    ).toBe(false);
  });

  test("returns false for a hostname that merely contains sendgrid", () => {
    expect(
      isSendGrid(
        makeConfig({
          smtpConnectionUri: "smtps://apikey@fake-sendgrid.net:465",
        })
      )
    ).toBe(false);
  });

  test("returns false when no URI is configured", () => {
    expect(isSendGrid(makeConfig({}))).toBe(false);
  });
});

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

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

let assertValidParams: () => void;

beforeAll(async () => {
  process.env.FIREBASE_KIT_INSTANCE_ID ??= "test-instance";
  ({ assertValidParams } = await import("../src/config"));
});

// AUTH_TYPE is a real param name that can collide with an ambient shell var,
// so start every test from a known environment.
beforeEach(() => {
  for (const name of ["AUTH_TYPE", "SMTP_CONNECTION_URI"]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const TTL_TYPES = "never, hour, day, week, month, year";
const TTL_VALUE = "The value must be an integer value greater than zero.";
const SMTP_URI = "Invalid SMTP connection URI";
const COLLECTION = "Must be a valid Cloud Firestore collection";
const FROM = "Must be a valid email address";

// Values the published extension's install API rejects (`days`, `0`, `abc`
// and `oauth2` checked with `validateOnly` against
// firebase/firestore-send-email@0.2.10; the rest fail the same select options
// or validationRegex in its extension.yaml).
const REJECTED: Array<[string, string, string]> = [
  ["TTL_EXPIRE_TYPE", "days", TTL_TYPES],
  ["TTL_EXPIRE_TYPE", "DAY", TTL_TYPES],
  ["TTL_EXPIRE_TYPE", "day ", TTL_TYPES],
  ["TTL_EXPIRE_VALUE", "0", TTL_VALUE],
  ["TTL_EXPIRE_VALUE", "abc", TTL_VALUE],
  ["TTL_EXPIRE_VALUE", "1.5", TTL_VALUE],
  ["TTL_EXPIRE_VALUE", "-1", TTL_VALUE],
  ["TTL_EXPIRE_VALUE", "01", TTL_VALUE],
  ["TTL_EXPIRE_VALUE", " ", TTL_VALUE],
  ["AUTH_TYPE", "oauth2", "UsernamePassword, OAuth2"],
  ["AUTH_TYPE", "ApiKey", "UsernamePassword, OAuth2"],
  ["OAUTH_SECURE", "yes", "true, false"],
  ["OAUTH_SECURE", "TRUE", "true, false"],
  ["OAUTH_SECURE", "1", "true, false"],
  ["DATABASE_REGION", "NAM5", "eur3, nam5, nam7"],
  ["DATABASE_REGION", "us-central2", "eur3, nam5, nam7"],
  ["SMTP_CONNECTION_URI", "smtp.gmail.com:465", SMTP_URI],
  ["SMTP_CONNECTION_URI", "smtps://smtp.gmail.com", SMTP_URI],
  ["SMTP_CONNECTION_URI", " ", SMTP_URI],
  ["MAIL_COLLECTION", "mail/doc", COLLECTION],
  ["MAIL_COLLECTION", "/mail", COLLECTION],
  ["DEFAULT_FROM", "not-an-email", FROM],
  ["DEFAULT_FROM", "Name <foo@bar>", FROM],
];

const ACCEPTED: Array<[string, string]> = [
  ["TTL_EXPIRE_TYPE", "never"],
  ["TTL_EXPIRE_TYPE", "hour"],
  ["TTL_EXPIRE_TYPE", "day"],
  ["TTL_EXPIRE_TYPE", "week"],
  ["TTL_EXPIRE_TYPE", "month"],
  ["TTL_EXPIRE_TYPE", "year"],
  ["TTL_EXPIRE_VALUE", "1"],
  ["TTL_EXPIRE_VALUE", "30"],
  ["AUTH_TYPE", "UsernamePassword"],
  ["AUTH_TYPE", "OAuth2"],
  ["OAUTH_SECURE", "true"],
  ["OAUTH_SECURE", "false"],
  ["DATABASE_REGION", "nam5"],
  ["DATABASE_REGION", "europe-west2"],
  ["SMTP_CONNECTION_URI", "smtps://username@smtp.hostname.com:465"],
  ["SMTP_CONNECTION_URI", "smtp://user:pass@smtp.hostname.com:587?pool=true"],
  ["MAIL_COLLECTION", "mail"],
  ["MAIL_COLLECTION", "users/uid/mail"],
  ["DEFAULT_FROM", "foobar@example.com"],
  ["DEFAULT_FROM", "Friendly Firebaser <foobar@example.com>"],
  // No select or validationRegex in the extension, so anything goes.
  ["DATABASE", "my-db"],
  ["TLS_OPTIONS", "not json"],
];

describe("assertValidParams", () => {
  test("passes when no params have been supplied yet", () => {
    expect(() => assertValidParams()).not.toThrow();
  });

  test.each(REJECTED)("rejects %s=%j", (name, value, allowed) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).toThrow(
      `${name}=${JSON.stringify(value)}`
    );
    expect(() => assertValidParams()).toThrow(allowed);
  });

  test.each(ACCEPTED)("accepts %s=%j", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).not.toThrow();
  });

  // The extension's installer accepts a select label and stores it verbatim,
  // so the kit accepts it too, even though it then runs as it did in the
  // extension: `Day` leaves every document unprocessed, `Yes` connects
  // without TLS, and a location label is not a region.
  test.each([
    ["TTL_EXPIRE_TYPE", "Never"],
    ["TTL_EXPIRE_TYPE", "Hour"],
    ["TTL_EXPIRE_TYPE", "Day"],
    ["TTL_EXPIRE_TYPE", "Week"],
    ["TTL_EXPIRE_TYPE", "Month"],
    ["TTL_EXPIRE_TYPE", "Year"],
    ["AUTH_TYPE", "Username & Password"],
    ["OAUTH_SECURE", "Yes"],
    ["OAUTH_SECURE", "No"],
    ["DATABASE_REGION", "Multi-region (United States)"],
    ["DATABASE_REGION", "Iowa (us-central1)"],
  ])("accepts the option label %s=%j", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => assertValidParams()).not.toThrow();
  });

  // Blank values belong to assertRequiredParams; optional ones may be blank,
  // as in the extension.
  test.each([
    "DATABASE",
    "DATABASE_REGION",
    "AUTH_TYPE",
    "OAUTH_SECURE",
    "MAIL_COLLECTION",
    "DEFAULT_FROM",
    "TTL_EXPIRE_TYPE",
    "TTL_EXPIRE_VALUE",
  ])("leaves an empty %s alone", (name) => {
    vi.stubEnv(name, "");

    expect(() => assertValidParams()).not.toThrow();
  });

  test("names every invalid param in one error", () => {
    vi.stubEnv("TTL_EXPIRE_TYPE", "days");
    vi.stubEnv("TTL_EXPIRE_VALUE", "0");

    expect(() => assertValidParams()).toThrow(
      /TTL_EXPIRE_TYPE="days".*; TTL_EXPIRE_VALUE="0"/
    );
  });
});

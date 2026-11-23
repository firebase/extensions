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

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Each case loads the compiled kit in a fresh process with only the given
// environment, as CLI discovery does, so the real firebase-functions registry
// reports which params were declared. The pretest hook builds lib/.
const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(KIT, "lib");

interface Loaded {
  declaredSecrets: string[];
  boundSecrets: string[];
  smtpPassword: string | null;
}

function loadKit(env: Record<string, string>): Loaded {
  const script = `
    const { declaredParams } = require("firebase-functions/params");
    const kit = require(${JSON.stringify(path.join(LIB, "index.js"))});
    const { configFromEnv } = require(${JSON.stringify(
      path.join(LIB, "config.js")
    )});
    const { resolveConfig } = require(${JSON.stringify(
      path.join(LIB, "export-config.js")
    )});
    console.log(JSON.stringify({
      declaredSecrets: declaredParams
        .filter((p) => p.toSpec().type === "secret")
        .map((p) => p.name),
      boundSecrets: kit.processQueue.__endpoint.secretEnvironmentVariables.map((s) => s.key),
      smtpPassword: resolveConfig(configFromEnv()).smtpPassword ?? null,
    }));
  `;
  const out = execFileSync(process.execPath, ["-e", script], {
    cwd: KIT,
    env: { PATH: process.env.PATH, DEFAULT_FROM: "from@example.com", ...env },
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop());
}

const OAUTH_SECRETS = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"];
const ALL_SECRETS = ["SMTP_PASSWORD", ...OAUTH_SECRETS];

describe("SMTP_PASSWORD declaration", () => {
  test.each([
    ["UsernamePassword", "smtp://u:inline@h.example:587"],
    ["UsernamePassword", "smtps://u:inline@h.example:465"],
    ["UsernamePassword", "smtp://u:inline@smtp.office365.com:587"],
  ])("is not declared for AUTH_TYPE=%s and %s", (authType, uri) => {
    const loaded = loadKit({
      AUTH_TYPE: authType,
      SMTP_CONNECTION_URI: uri,
    });
    expect(loaded.declaredSecrets).toEqual(OAUTH_SECRETS);
    expect(loaded.boundSecrets).toEqual(OAUTH_SECRETS);
    expect(loaded.smtpPassword).toBeNull();
  });

  test("is not declared when AUTH_TYPE is unset and the URI has a password", () => {
    const loaded = loadKit({
      SMTP_CONNECTION_URI: "smtp://u:inline@h.example:587",
    });
    expect(loaded.declaredSecrets).toEqual(OAUTH_SECRETS);
    expect(loaded.boundSecrets).toEqual(OAUTH_SECRETS);
  });

  test.each([
    ["UsernamePassword", "smtp://u@h.example:587", "URI without a password"],
    [
      "UsernamePassword",
      "smtp://u:@h.example:587",
      "URI with an empty password",
    ],
    ["UsernamePassword", "smtp://h.example:587", "URI without userinfo"],
    ["UsernamePassword", "", "empty URI"],
    ["UsernamePassword", "smtp://u:inline@h.example:99999", "unparseable URI"],
    ["OAuth2", "smtp://u:inline@h.example:587", "OAuth2 with a URI password"],
    [
      "UsernamePassword",
      "smtp://apikey:SG.inline@smtp.sendgrid.net:587",
      "SendGrid URI with an inline password",
    ],
    [
      "OAuth2",
      "smtps://apikey:SG.inline@smtp.sendgrid.net:465",
      "SendGrid URI with an inline password under OAuth2",
    ],
  ])("is declared and bound for AUTH_TYPE=%s and %s (%s)", (authType, uri) => {
    const loaded = loadKit({ AUTH_TYPE: authType, SMTP_CONNECTION_URI: uri });
    expect(loaded.declaredSecrets).toEqual(ALL_SECRETS);
    expect(loaded.boundSecrets).toEqual(ALL_SECRETS);
  });

  test("is declared and bound when SMTP_CONNECTION_URI is not in the environment", () => {
    const loaded = loadKit({ AUTH_TYPE: "UsernamePassword" });
    expect(loaded.declaredSecrets).toEqual(ALL_SECRETS);
    expect(loaded.boundSecrets).toEqual(ALL_SECRETS);
  });

  // A deploy that could not see the URI at discovery binds the secret, and its
  // runtime has both values in the environment.
  test("a bound SMTP_PASSWORD still overrides the URI password at runtime", () => {
    const loaded = loadKit({
      AUTH_TYPE: "UsernamePassword",
      SMTP_CONNECTION_URI: "smtp://u:inline@h.example:587",
      SMTP_PASSWORD: "bound",
    });
    expect(loaded.declaredSecrets).toEqual(ALL_SECRETS);
    expect(loaded.smtpPassword).toBe("bound");
  });
});

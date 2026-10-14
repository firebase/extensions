/*
 * Copyright 2019 Google LLC
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

import { URL } from "node:url";
import type { Transporter } from "nodemailer";
import { createTransport } from "nodemailer";
import type { ResolvedSendEmailConfig } from "./export-config";
import { invalidTlsOptions, invalidURI } from "./logs";
import { SendGridTransport } from "./nodemailer-sendgrid";
import { AuthenticatonType } from "./types";

function compileUrl(value?: string): URL | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function checkMicrosoftServer(hostname: string): boolean {
  return (
    hostname.includes("outlook") ||
    hostname.includes("office365") ||
    hostname.includes("hotmail")
  );
}

export function parseTlsOptions(tlsOptions: string) {
  let tls = { rejectUnauthorized: false };
  try {
    tls = JSON.parse(tlsOptions);
  } catch {
    invalidTlsOptions();
  }
  return tls;
}

export function isSendGrid(config: ResolvedSendEmailConfig): boolean {
  try {
    const url = new URL(config.smtpConnectionUri || "");
    return url.hostname === "smtp.sendgrid.net";
  } catch {
    return false;
  }
}

export function setupOAuth2(config: ResolvedSendEmailConfig): Transporter {
  return createTransport({
    host: config.host,
    port: config.oauthPort,
    secure: config.oauthSecure,
    auth: {
      type: AuthenticatonType.OAuth2,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      user: config.user,
      refreshToken: config.refreshToken,
    },
  });
}

export function setSmtpCredentials(
  config: ResolvedSendEmailConfig
): Transporter {
  if (config.authType === AuthenticatonType.OAuth2) {
    return setupOAuth2(config);
  }

  const url = compileUrl(config.smtpConnectionUri);
  if (!url) {
    invalidURI();
    throw new Error(
      "Invalid URI: please reconfigure with a valid SMTP connection URI"
    );
  }

  if (url.password) {
    url.password = encodeURIComponent(url.password);
  }

  if (url.hostname && config.smtpPassword) {
    url.password = encodeURIComponent(config.smtpPassword);
  }

  if (checkMicrosoftServer(url.hostname)) {
    return createTransport({
      service: "hotmail",
      auth: {
        user: decodeURIComponent(url.username),
        pass: decodeURIComponent(url.password),
      },
    });
  }

  return createTransport(url.href, {
    tls: parseTlsOptions(config.tlsOptions),
  });
}

export async function transportLayer(
  config: ResolvedSendEmailConfig
): Promise<Transporter> {
  if (config.testing) {
    return createTransport({
      host: "127.0.0.1",
      port: 8132,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  if (isSendGrid(config)) {
    return createTransport(
      new SendGridTransport({ apiKey: config.smtpPassword }) as never
    );
  }

  return setSmtpCredentials(config);
}

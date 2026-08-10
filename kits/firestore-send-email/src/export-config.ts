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

import type { Expression } from "firebase-functions/params";
import { AuthenticatonType } from "./types";

export interface SecretLike {
  value(): string;
}

export type SecretValue = string | SecretLike;
export type TtlExpireType =
  | "never"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

export interface SendEmailConfig {
  databaseId?: string;
  databaseRegion: string;
  mailCollection: string;
  smtpConnectionUri?: string;
  smtpPassword?: SecretValue;
  defaultFrom: string;
  defaultReplyTo?: string;
  usersCollection?: string;
  templatesCollection?: string;
  testing?: boolean;
  ttlExpireType?: TtlExpireType;
  ttlExpireValue?: number;
  tlsOptions?: string;
  host?: string;
  oauthPort?: number;
  oauthSecure?: boolean;
  user?: string;
  clientId?: SecretValue;
  clientSecret?: SecretValue;
  refreshToken?: SecretValue;
  authType?: AuthenticatonType;
}

export interface DeployTimeOptions {
  document: string | Expression<string>;
  database: string | Expression<string>;
  region: string | Expression<string>;
}

export interface ResolvedSendEmailConfig {
  databaseId: string;
  databaseRegion: string;
  mailCollection: string;
  smtpConnectionUri?: string;
  smtpPassword?: string;
  defaultFrom: string;
  defaultReplyTo?: string;
  usersCollection?: string;
  templatesCollection?: string;
  testing: boolean;
  ttlExpireType: TtlExpireType;
  ttlExpireValue: number;
  tlsOptions: string;
  host?: string;
  oauthPort?: number;
  oauthSecure: boolean;
  user?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  authType: AuthenticatonType;
}

export function resolveSecret(value?: SecretValue): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return value?.value();
}

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveConfig(
  config: SendEmailConfig
): ResolvedSendEmailConfig {
  return {
    databaseId: config.databaseId || "(default)",
    databaseRegion: config.databaseRegion,
    mailCollection: config.mailCollection,
    smtpConnectionUri: normalizeOptional(config.smtpConnectionUri),
    smtpPassword: normalizeOptional(resolveSecret(config.smtpPassword)),
    defaultFrom: config.defaultFrom,
    defaultReplyTo: normalizeOptional(config.defaultReplyTo),
    usersCollection: normalizeOptional(config.usersCollection),
    templatesCollection: normalizeOptional(config.templatesCollection),
    testing: config.testing === true,
    ttlExpireType: config.ttlExpireType || "never",
    ttlExpireValue: config.ttlExpireValue || 1,
    tlsOptions: config.tlsOptions || "{}",
    host: normalizeOptional(config.host),
    oauthPort: config.oauthPort,
    oauthSecure: config.oauthSecure !== false,
    user: normalizeOptional(config.user),
    clientId: normalizeOptional(resolveSecret(config.clientId)),
    clientSecret: normalizeOptional(resolveSecret(config.clientSecret)),
    refreshToken: normalizeOptional(resolveSecret(config.refreshToken)),
    authType: config.authType || AuthenticatonType.UsernamePassword,
  };
}

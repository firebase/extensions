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

import {
  defineBoolean,
  defineInt,
  defineSecret,
  defineString,
  expr,
  select,
} from "firebase-functions/params";
import type {
  DeployTimeOptions,
  SecretValue,
  SendEmailConfig,
} from "./export-config";
import { AuthenticatonType } from "./types";

const DATABASE_REGION_OPTIONS = [
  "eur3",
  "nam5",
  "nam7",
  "us-central1",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "us-east1",
  "us-east4",
  "us-east5",
  "us-south1",
  "northamerica-northeast1",
  "northamerica-northeast2",
  "northamerica-south1",
  "southamerica-east1",
  "southamerica-west1",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "europe-west8",
  "europe-west9",
  "europe-west10",
  "europe-west12",
  "europe-southwest1",
  "europe-north1",
  "europe-north2",
  "europe-central2",
  "me-central1",
  "me-central2",
  "me-west1",
  "asia-south1",
  "asia-south2",
  "asia-southeast1",
  "asia-southeast2",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "australia-southeast1",
  "australia-southeast2",
  "africa-south1",
] as const;
const TTL_EXPIRE_TYPE_OPTIONS = [
  "never",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

const params = {
  databaseId: defineString("DATABASE", { default: "(default)" }),
  databaseRegion: defineString("DATABASE_REGION", {
    input: select([...DATABASE_REGION_OPTIONS]),
  }),
  authType: defineString("AUTH_TYPE", {
    default: AuthenticatonType.UsernamePassword,
    input: select([
      AuthenticatonType.UsernamePassword,
      AuthenticatonType.OAuth2,
    ]),
  }),
  smtpConnectionUri: defineString("SMTP_CONNECTION_URI", {
    default: "",
    input: {
      text: {
        validationRegex:
          /^(smtp[s]*:\/\/(.*?(:[^:@]*)?@)?[^:@]+:[0-9]+(\?[^ ]*)?)|^$/,
        validationErrorMessage:
          "Invalid SMTP connection URI. Must be in the form `smtp(s)://username:password@hostname:port` or `smtp(s)://username@hostname:port` or to be left blank.",
      },
    },
  }),
  smtpPassword: defineSecret("SMTP_PASSWORD"),
  host: defineString("HOST", { default: "" }),
  oauthPort: defineInt("OAUTH_PORT", { default: 465 }),
  oauthSecure: defineBoolean("OAUTH_SECURE", {
    default: true,
  }),
  clientId: defineSecret("CLIENT_ID"),
  clientSecret: defineSecret("CLIENT_SECRET"),
  refreshToken: defineSecret("REFRESH_TOKEN"),
  user: defineString("USER", { default: "" }),
  mailCollection: defineString("MAIL_COLLECTION", {
    default: "mail",
    input: {
      text: {
        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore collection",
      },
    },
  }),
  defaultFrom: defineString("DEFAULT_FROM", {
    input: {
      text: {
        validationRegex:
          /^(([^<>()\[\]\.,;:\s@"]+(\.[^<>()\[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$|^.*<(([^<>()\[\]\.,;:\s@"]+(\.[^<>()\[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})>$/,
        validationErrorMessage:
          "Must be a valid email address or valid name plus email address",
      },
    },
  }),
  defaultReplyTo: defineString("DEFAULT_REPLY_TO", { default: "" }),
  usersCollection: defineString("USERS_COLLECTION", { default: "" }),
  templatesCollection: defineString("TEMPLATES_COLLECTION", { default: "" }),
  ttlExpireType: defineString("TTL_EXPIRE_TYPE", {
    default: "never",
    input: select([...TTL_EXPIRE_TYPE_OPTIONS]),
  }),
  ttlExpireValue: defineInt("TTL_EXPIRE_VALUE", {
    default: 1,
    input: {
      text: {
        validationRegex: /^[1-9][0-9]*$/,
        validationErrorMessage:
          "The value must be an integer value greater than zero.",
      },
    },
  }),
  tlsOptions: defineString("TLS_OPTIONS", { default: "{}" }),
};

export const secretParams = [
  params.smtpPassword,
  params.clientId,
  params.clientSecret,
  params.refreshToken,
];

export function secretParamsForAuthType(authType?: string) {
  switch (authType || AuthenticatonType.UsernamePassword) {
    case AuthenticatonType.OAuth2:
      return [params.clientId, params.clientSecret, params.refreshToken];
    case AuthenticatonType.UsernamePassword:
    case AuthenticatonType.ApiKey:
      return [params.smtpPassword];
    default:
      throw new Error(
        `Unsupported AUTH_TYPE for firestore-send-email: ${authType}`
      );
  }
}

function optionalSecret(
  value: ReturnType<typeof defineSecret>
): SecretValue | undefined {
  return value;
}

export function configFromEnv(): SendEmailConfig {
  const authType = params.authType.value() as AuthenticatonType;

  return {
    databaseId: params.databaseId.value(),
    databaseRegion: params.databaseRegion.value(),
    mailCollection: params.mailCollection.value(),
    smtpConnectionUri: params.smtpConnectionUri.value(),
    smtpPassword:
      authType === AuthenticatonType.OAuth2
        ? undefined
        : optionalSecret(params.smtpPassword),
    defaultFrom: params.defaultFrom.value(),
    defaultReplyTo: params.defaultReplyTo.value(),
    usersCollection: params.usersCollection.value(),
    templatesCollection: params.templatesCollection.value(),
    ttlExpireType:
      params.ttlExpireType.value() as SendEmailConfig["ttlExpireType"],
    ttlExpireValue: params.ttlExpireValue.value(),
    tlsOptions: params.tlsOptions.value(),
    host: params.host.value(),
    oauthPort: params.oauthPort.value(),
    oauthSecure: params.oauthSecure.value(),
    user: params.user.value(),
    clientId:
      authType === AuthenticatonType.OAuth2
        ? optionalSecret(params.clientId)
        : undefined,
    clientSecret:
      authType === AuthenticatonType.OAuth2
        ? optionalSecret(params.clientSecret)
        : undefined,
    refreshToken:
      authType === AuthenticatonType.OAuth2
        ? optionalSecret(params.refreshToken)
        : undefined,
    authType,
  };
}

export function envDeployOptions(): DeployTimeOptions {
  return {
    document: expr`${params.mailCollection}/{documentId}`,
    database: params.databaseId,
    region: params.databaseRegion,
  };
}

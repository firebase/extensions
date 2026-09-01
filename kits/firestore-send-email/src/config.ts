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
  databaseId: defineString("DATABASE", {
    label: "Firestore Instance ID",
    description:
      'The Firestore database to use. Use "(default)" for the default database. You can find your available Firestore databases at [https://console.cloud.google.com/firestore/databases](https://console.cloud.google.com/firestore/databases).',
    default: "(default)",
    input: { text: { example: "(default)" } },
  }),
  databaseRegion: defineString("DATABASE_REGION", {
    label: "Firestore Instance Location",
    description:
      "Where is the Firestore database located? You can check your current database location at [https://console.cloud.google.com/firestore/databases](https://console.cloud.google.com/firestore/databases).",

    input: select({
      "Multi-region (Europe - Belgium and Netherlands)": "eur3",
      "Multi-region (United States)": "nam5",
      "Multi-region (Iowa, North Virginia, and Oklahoma)": "nam7",
      "Iowa (us-central1)": "us-central1",
      "Oregon (us-west1)": "us-west1",
      "Los Angeles (us-west2)": "us-west2",
      "Salt Lake City (us-west3)": "us-west3",
      "Las Vegas (us-west4)": "us-west4",
      "South Carolina (us-east1)": "us-east1",
      "Northern Virginia (us-east4)": "us-east4",
      "Columbus (us-east5)": "us-east5",
      "Dallas (us-south1)": "us-south1",
      "Montreal (northamerica-northeast1)": "northamerica-northeast1",
      "Toronto (northamerica-northeast2)": "northamerica-northeast2",
      "Queretaro (northamerica-south1)": "northamerica-south1",
      "Sao Paulo (southamerica-east1)": "southamerica-east1",
      "Santiago (southamerica-west1)": "southamerica-west1",
      "Belgium (europe-west1)": "europe-west1",
      "London (europe-west2)": "europe-west2",
      "Frankfurt (europe-west3)": "europe-west3",
      "Netherlands (europe-west4)": "europe-west4",
      "Zurich (europe-west6)": "europe-west6",
      "Milan (europe-west8)": "europe-west8",
      "Paris (europe-west9)": "europe-west9",
      "Berlin (europe-west10)": "europe-west10",
      "Turin (europe-west12)": "europe-west12",
      "Madrid (europe-southwest1)": "europe-southwest1",
      "Finland (europe-north1)": "europe-north1",
      "Stockholm (europe-north2)": "europe-north2",
      "Warsaw (europe-central2)": "europe-central2",
      "Doha (me-central1)": "me-central1",
      "Dammam (me-central2)": "me-central2",
      "Tel Aviv (me-west1)": "me-west1",
      "Mumbai (asia-south1)": "asia-south1",
      "Delhi (asia-south2)": "asia-south2",
      "Singapore (asia-southeast1)": "asia-southeast1",
      "Jakarta (asia-southeast2)": "asia-southeast2",
      "Taiwan (asia-east1)": "asia-east1",
      "Hong Kong (asia-east2)": "asia-east2",
      "Tokyo (asia-northeast1)": "asia-northeast1",
      "Osaka (asia-northeast2)": "asia-northeast2",
      "Seoul (asia-northeast3)": "asia-northeast3",
      "Sydney (australia-southeast1)": "australia-southeast1",
      "Melbourne (australia-southeast2)": "australia-southeast2",
      "Johannesburg (africa-south1)": "africa-south1",
    }),
  }),
  authType: defineString("AUTH_TYPE", {
    label: "Authentication Type",
    description:
      "The authentication type to be used for the SMTP server (e.g., OAuth2, Username & Password).",

    default: AuthenticatonType.UsernamePassword,
    input: select({
      "Username & Password": "UsernamePassword",
      OAuth2: "OAuth2",
    }),
  }),
  smtpConnectionUri: defineString("SMTP_CONNECTION_URI", {
    label: "SMTP connection URI",
    description:
      "A URI representing an SMTP server this extension can use to deliver email. Note that port 25 is blocked by Google Cloud Platform, so we recommend using port 587 for SMTP connections. If you're using the SMTPS protocol, we recommend using port 465. In order to keep passwords secure, it is recommended to omit the password from the connection string while using the `SMTP Password` field for entering secrets and passwords. Passwords and secrets should now be included in `SMTP password` field.\nSecure format:\n `smtps://username@gmail.com@smtp.gmail.com:465` (username only)\n `smtps://smtp.gmail.com:465` (No username and password)\nBackwards Compatible (less secure):\n `smtps://username@gmail.com:password@smtp.gmail.com:465`. (username and\npassword)",

    default: "",
    input: {
      text: {
        example: "smtps://username@smtp.hostname.com:465",

        validationRegex:
          /^(smtp[s]*:\/\/(.*?(:[^:@]*)?@)?[^:@]+:[0-9]+(\?[^ ]*)?)|^$/,
        validationErrorMessage:
          "Invalid SMTP connection URI. Must be in the form `smtp(s)://username:password@hostname:port` or `smtp(s)://username@hostname:port` or to be left blank.",
      },
    },
  }),
  smtpPassword: defineSecret("SMTP_PASSWORD", {
    label: "SMTP password",
    description: "User password for the SMTP server",
  }),
  host: defineString("HOST", {
    label: "OAuth2 SMTP Host",
    description:
      "The OAuth2 hostname of the SMTP server (e.g., smtp.gmail.com).",
    default: "",
  }),
  oauthPort: defineInt("OAUTH_PORT", {
    label: "OAuth2 SMTP Port",
    description:
      "The OAuth2 port number for the SMTP server (e.g., 465 for SMTPS, 587 for STARTTLS).",
    default: 465,
  }),
  oauthSecure: defineBoolean("OAUTH_SECURE", {
    label: "Use secure OAuth2 connection?",
    description:
      "Set to true to enable a secure connection (TLS/SSL) when using OAuth2 authentication for the SMTP server.",

    default: true,
  }),
  clientId: defineSecret("CLIENT_ID", {
    label: "OAuth2 Client ID",
    description:
      "The OAuth2 Client ID for authentication with the SMTP server.",
  }),
  clientSecret: defineSecret("CLIENT_SECRET", {
    label: "OAuth2 Client Secret",
    description:
      "The OAuth2 Client Secret for authentication with the SMTP server.",
  }),
  refreshToken: defineSecret("REFRESH_TOKEN", {
    label: "OAuth2 Refresh Token",
    description:
      "The OAuth2 Refresh Token for authentication with the SMTP server.",
  }),
  user: defineString("USER", {
    label: "OAuth2 SMTP User",
    description: "The OAuth2 user email or username for SMTP authentication.",
    default: "",
  }),
  mailCollection: defineString("MAIL_COLLECTION", {
    label: "Email documents collection",
    description:
      "What is the path to the collection that contains the documents used to build and send the emails?",

    default: "mail",
    input: {
      text: {
        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore collection",
      },
    },
  }),
  defaultFrom: defineString("DEFAULT_FROM", {
    label: "Default FROM address",
    description:
      "The email address to use as the sender's address (if it's not specified in the added email document). You can optionally include a name with the email address (`Friendly Firebaser <foobar@example.com>`). This parameter does not work with [Gmail SMTP](https://nodemailer.com/usage/using-gmail/).",

    input: {
      text: {
        example: "foobar@example.com",

        validationRegex:
          /^(([^<>()\[\]\.,;:\s@"]+(\.[^<>()\[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})$|^.*<(([^<>()\[\]\.,;:\s@"]+(\.[^<>()\[\]\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\.,;:\s@"]+\.)+[^<>()[\]\.,;:\s@"]{2,})>$/,
        validationErrorMessage:
          "Must be a valid email address or valid name plus email address",
      },
    },
  }),
  defaultReplyTo: defineString("DEFAULT_REPLY_TO", {
    label: "Default REPLY-TO address",
    description:
      "The email address to use as the reply-to address (if it's not specified in the added email document).",
    default: "",
  }),
  usersCollection: defineString("USERS_COLLECTION", {
    label: "Users collection",
    description:
      "A collection of documents keyed by user UID. If the `toUids`, `ccUids`, and/or `bccUids` recipient options are used in the added email document, this extension delivers email to the `email` field based on lookups in this collection.",
    default: "",
  }),
  templatesCollection: defineString("TEMPLATES_COLLECTION", {
    label: "Templates collection",
    description:
      "A collection of email templates keyed by name. This extension can render an email using a [Handlebar](https://handlebarsjs.com/) template, it's recommended to use triple curly braces `{{{  }}}` in your Handlebars templates when the substitution value is a URL or otherwise sensitive to HTML escaping.",
    default: "",
  }),
  ttlExpireType: defineString("TTL_EXPIRE_TYPE", {
    label: "Firestore TTL type",
    description:
      'Do you want the firestore records to be marked with an expireAt field for a TTL policy? If "Never" is selected then no expireAt field will be added. Otherwise you may specify the unit of time specified by the TTL_EXPIRE_VALUE parameter. Defaults to "Never".',

    default: "never",
    input: select({
      Never: "never",
      Hour: "hour",
      Day: "day",
      Week: "week",
      Month: "month",
      Year: "year",
    }),
  }),
  ttlExpireValue: defineInt("TTL_EXPIRE_VALUE", {
    label: "Firestore TTL value",
    description:
      "In the units specified by TTL_EXPIRE_TYPE, how long do you want records to be ineligible for deletion by a TTL policy? This parameter requires the Firestore TTL type parameter to be set to a value other than `Never`. For example, if `Firestore TTL type` is set to `Day` then setting this parameter to `1` will specify a TTL of 1 day.",

    default: 1,
    input: {
      text: {
        validationRegex: /^[1-9][0-9]*$/,
        validationErrorMessage:
          "The value must be an integer value greater than zero.",
      },
    },
  }),
  tlsOptions: defineString("TLS_OPTIONS", {
    label: "TLS Options",
    description:
      "A JSON value representing TLS options. For more information, see https://nodejs.org/api/tls.html#tls_class_tls_tlssocket",
    default: "{}",
  }),
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

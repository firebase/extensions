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
import { firestoreLocationToFunctionRegion } from "./region";
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
    // `required: true` in the extension, which refuses an empty answer.
    input: { text: { example: "(default)", nonEmpty: true } },
  }),
  databaseRegion: defineString("DATABASE_REGION", {
    label: "Firestore Instance Location",
    description:
      "Where is the Firestore database located? You can check your current database location at [https://console.cloud.google.com/firestore/databases](https://console.cloud.google.com/firestore/databases). The function in this kit deploys to the Cloud Run region closest to this location.",

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
    input: select({ Yes: true, No: false }),
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
      // The SendGrid transport reads SMTP_PASSWORD as its API key regardless
      // of auth type, so it must stay bound under OAuth2.
      return [
        params.smtpPassword,
        params.clientId,
        params.clientSecret,
        params.refreshToken,
      ];
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
    // Not gated on auth type: the SendGrid transport reads it as its API key
    // even when AUTH_TYPE is OAuth2.
    smtpPassword: optionalSecret(params.smtpPassword),
    defaultFrom: params.defaultFrom.value(),
    defaultReplyTo: params.defaultReplyTo.value(),
    usersCollection: params.usersCollection.value(),
    templatesCollection: params.templatesCollection.value(),
    // Read straight from the environment, not declared as a param: the
    // extension never surfaced TESTING in extension.yaml either.
    testing: process.env.TESTING === "true",
    ttlExpireType:
      params.ttlExpireType.value() as SendEmailConfig["ttlExpireType"],
    ttlExpireValue: params.ttlExpireValue.value(),
    tlsOptions: params.tlsOptions.value(),
    host: params.host.value(),
    oauthPort: params.oauthPort.value(),
    // The extension platform swapped a blank optional value for its default
    // (`true`), but the boolean param reads "" as false.
    oauthSecure:
      process.env.OAUTH_SECURE === "" ? undefined : params.oauthSecure.value(),
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
  // The location to Cloud Run region lookup needs a nested ternary, which the
  // CLI's CEL subset cannot express, so the value is read from `process.env`
  // (populated from `.env` during CLI discovery) rather than passed as a param
  // expression.
  const region = firestoreLocationToFunctionRegion(process.env.DATABASE_REGION);

  return {
    document: expr`${params.mailCollection}/{documentId}`,
    database: params.databaseId,
    ...(region ? { region } : {}),
  };
}

// Params the published extension marks `required: true`. A value the user never
// supplied is absent from process.env; one they deliberately blanked is present
// and empty. Only the second is a misconfiguration, so the guard below reads
// process.env rather than `.value()`, which reports both as "".
// DATABASE_REGION is `required: true` upstream but deliberately omitted here:
// an explicit empty value is a supported setting that leaves the function
// without a declared region, so the CLI resolves one at deploy time.
const REQUIRED_PARAMS = [
  "DATABASE",
  "AUTH_TYPE",
  "MAIL_COLLECTION",
  "DEFAULT_FROM",
  "TTL_EXPIRE_TYPE",
  "TTL_EXPIRE_VALUE",
] as const;

/**
 * Rejects required params that were explicitly set to an empty value.
 *
 * `.env` values bypass the CLI's prompt-time validation and take precedence
 * over a param's declared default, so an empty entry otherwise reaches the
 * handlers silently. Called at module scope so deploy-time discovery fails
 * before the function ships, rather than on the first event.
 */
export function assertRequiredParams(
  names: ReadonlyArray<string> = REQUIRED_PARAMS
): void {
  const blank = names.filter((name) => {
    const raw = process.env[name];
    return raw !== undefined && raw.trim() === "";
  });

  if (blank.length > 0) {
    throw new Error(
      `Required parameters are set to an empty value: ${blank.join(", ")}. ` +
        "Set them in your .env file, or remove the entries to use their defaults."
    );
  }
}

/**
 * Rejects param values the published extension refuses at install time: a
 * select value that is not one of its option values or labels, or a text value
 * that fails its `validationRegex`.
 *
 * The CLI applies a param's `input` only when it prompts, so a value already
 * in `.env` reaches the handlers unchecked, and they coerce it
 * (`TTL_EXPIRE_TYPE=days` leaves every document without a `delivery` field,
 * and `TTL_EXPIRE_VALUE=-1` sets an `expireAt` in the past, for example).
 * Option labels such as `Day` are accepted, as the extension's installer
 * accepted them, and run as the extension ran them. Unset and empty values are
 * skipped: defaults cover the first, and `assertRequiredParams` decides about
 * the second. Called at module scope so deploy-time discovery fails before the
 * function ships.
 */
export function assertValidParams(): void {
  const invalid: string[] = [];

  for (const param of Object.values(params)) {
    const raw = process.env[param.name];
    // Secrets declare no `input`.
    const declared = param.options;
    const input = declared && "input" in declared ? declared.input : undefined;
    if (raw === undefined || raw === "" || !input) {
      continue;
    }

    const setting = `${param.name}=${JSON.stringify(raw)}`;
    if ("select" in input) {
      const { options } = input.select;
      const allowed = options.map(({ value }) => String(value));
      const labels = options.map((option) => option.label);
      if (!allowed.includes(raw) && !labels.includes(raw)) {
        invalid.push(`${setting} must be one of: ${allowed.join(", ")}`);
      }
    } else if ("text" in input && input.text.validationRegex) {
      const regex = new RegExp(input.text.validationRegex);
      if (!regex.test(raw)) {
        const reason =
          input.text.validationErrorMessage ?? `must match ${regex}`;
        invalid.push(`${setting}: ${reason}`);
      }
    }
  }

  // Not an install-time check in the extension, which accepted a blank URI but
  // could never send mail with it. The handlers send through the URI under any
  // auth type but OAuth2, so a blank one leaves every document without a
  // `delivery` field. The TESTING transport ignores the URI, and an invalid
  // AUTH_TYPE is reported above.
  const authType = process.env.AUTH_TYPE || AuthenticatonType.UsernamePassword;
  if (
    process.env.SMTP_CONNECTION_URI === "" &&
    authType !== AuthenticatonType.OAuth2 &&
    !invalid.some((message) => message.startsWith("AUTH_TYPE=")) &&
    process.env.TESTING !== "true"
  ) {
    invalid.push(
      `SMTP_CONNECTION_URI="" must be set unless AUTH_TYPE is ${AuthenticatonType.OAuth2}`
    );
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid parameter values: ${invalid.join("; ")}. ` +
        "Fix them in this instance's .env or .env.<projectId> file, or remove " +
        "the entries to use their defaults."
    );
  }
}

/**
 * Runs `assertRequiredParams` and `assertValidParams` and throws once with
 * both messages, so a `.env` with a blank required param and an invalid value
 * reports both in one deploy rather than one per redeploy.
 */
export function assertParams(): void {
  const errors: string[] = [];

  for (const check of [assertRequiredParams, assertValidParams]) {
    try {
      check();
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

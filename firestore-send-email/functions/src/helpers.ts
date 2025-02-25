import { createTransport } from "nodemailer";
import { URL } from "url";
import { invalidTlsOptions, invalidURI } from "./logs";
import { AuthenticatonType, Config } from "./types";
import { logger } from "firebase-functions/v1";

function compileUrl($: string): URL | null {
  try {
    return new URL($);
  } catch (ex) {
    return null;
  }
}

function checkMicrosoftServer($: string): boolean {
  return (
    $.includes("outlook") || $.includes("office365") || $.includes("hotmail")
  );
}

export function parseTlsOptions(tlsOptions: string) {
  let tls = { rejectUnauthorized: false };

  try {
    tls = JSON.parse(tlsOptions);
  } catch (ex) {
    invalidTlsOptions();
  }

  return tls;
}

export function setSmtpCredentials(config: Config) {
  /** Check if 0Auth2 authentication type */
  if (config.authenticationType === AuthenticatonType.OAuth2) {
    /** Return an 0Auth2 based transport */

    const transporter = setupOAuth2(config);

    logger.info("OAuth2 transport setup successfully");
    return transporter;
  }

  let url: URL;
  let transport;

  const { smtpConnectionUri, smtpPassword } = config;

  /** Generate Url object */
  url = compileUrl(smtpConnectionUri);

  /** return null if invalid url */
  if (!url) {
    invalidURI();
    throw new Error(
      `Invalid URI: please reconfigure with a valid SMTP connection URI`
    );
  }

  /** encode uri password if exists */
  if (url.password) {
    url.password = encodeURIComponent(url.password);
  }

  /** encode secret password if exists */
  if (url.hostname && smtpPassword) {
    url.password = encodeURIComponent(smtpPassword);
  }

  // Outlook requires explicit configuration
  if (checkMicrosoftServer(url.hostname)) {
    transport = createTransport({
      service: "hotmail",
      auth: {
        user: decodeURIComponent(url.username),
        pass: decodeURIComponent(url.password),
      },
    });
  } else {
    transport = createTransport(url.href, {
      tls: parseTlsOptions(config.tls),
    });
  }

  return transport;
}

export function isSendGrid(config: Config): boolean {
  try {
    const url = new URL(config.smtpConnectionUri);
    // Ensure the hostname matches exactly
    return url.hostname === "smtp.sendgrid.net";
  } catch (err) {
    return false;
  }
}

export function setupOAuth2(config: Config) {
  const { clientId, clientSecret, refreshToken, user, host, port, secure } =
    config;
  try {
    return createTransport({
      host,
      port,
      secure,
      auth: {
        type: AuthenticatonType.OAuth2,
        clientId,
        clientSecret,
        user,
        refreshToken,
      },
    });
  } catch (err) {
    throw new Error("Error setting up OAuth2 transport");
  }
}

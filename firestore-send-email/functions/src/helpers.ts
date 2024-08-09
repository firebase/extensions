import { createTransport } from "nodemailer";
import { URL } from "url";
import { invalidTlsOptions, invalidURI } from "./logs";
import { Config } from "./types";

/**
 * Utility function to compile a URL object
 */
function compileUrl($: string): URL | null {
  try {
    return new URL($);
  } catch (ex) {
    return null;
  }
}

/**
 * Utility function to check if the server is a Microsoft server
 */
function checkMicrosoftServer($: string): boolean {
  return (
    $.includes("outlook") || $.includes("office365") || $.includes("hotmail")
  );
}

/**
 * Utility function to parse TLS options from a string
 */
export function parseTlsOptions(tlsOptions: string) {
  let tls = { rejectUnauthorized: false };

  try {
    tls = JSON.parse(tlsOptions);
  } catch (ex) {
    invalidTlsOptions();
  }

  return tls;
}

/**
 * Function to validate and sanitize the hostname for SendGrid
 */
function isSendGridHost(hostname: string): boolean {
  return hostname === "smtp.sendgrid.net";
}

/**
 * Function to set SMTP credentials
 */
export function setSmtpCredentials(config: Config) {
  let url: URL;
  let transport;

  const { smtpConnectionUri, smtpPassword } = config;

  /** Generate Url object */
  url = compileUrl(smtpConnectionUri);

  /** Return null if invalid URL */
  if (!url) {
    invalidURI();
    throw new Error(
      `Invalid URI: please reconfigure with a valid SMTP connection URI`
    );
  }

  /** Encode URI password if it exists */
  if (url.password) {
    url.password = encodeURIComponent(url.password);
  }

  /** Encode secret password if it exists */
  if (url.hostname && smtpPassword) {
    url.password = encodeURIComponent(smtpPassword);
  }

  // Configure transport based on the server
  if (checkMicrosoftServer(url.hostname)) {
    transport = createTransport({
      service: "hotmail",
      auth: {
        user: decodeURIComponent(url.username),
        pass: decodeURIComponent(url.password),
      },
    });
  } else if (isSendGridHost(url.hostname)) {
    // SendGrid configuration via SMTP with strict hostname validation
    transport = createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      auth: {
        user: "apikey",
        pass: decodeURIComponent(url.password),
      },
      tls: parseTlsOptions(config.tls),
    });
  } else {
    // Generic SMTP transport
    transport = createTransport(url.href, {
      tls: parseTlsOptions(config.tls),
    });
  }

  return transport;
}

/**
 * Function to set SendGrid transport using nodemailer without the sendgrid module
 */
export function setSendGridTransport(config: Config) {
  const { smtpPassword } = config;

  return createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    auth: {
      user: "apikey",
      pass: smtpPassword,
    },
    tls: parseTlsOptions(config.tls),
  });
}

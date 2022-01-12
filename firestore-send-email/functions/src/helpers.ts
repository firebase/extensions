import { createTransport } from "nodemailer";
import { URL } from "url";
import { Config } from "./types";

export const setSmtpCredentials = (config: Config) => {
  const { smtpConnectionUri, smtpPassword } = config;
  let url = new URL(smtpConnectionUri);
  let transport;

  if (!url) {
    transport = null;
  }

  if (url.hostname && smtpPassword) {
    url.password = smtpPassword;
  }

  transport = createTransport(url.href);

  return transport;
};

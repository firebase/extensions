import { createTransport, Transporter } from "nodemailer";
import { URL, format } from "url";
import { Config } from "./types";

export const setSmtpCredentials = (config: Config) => {
  const { smtpConnectionUri, smtpPassword } = config;
  let url = new URL(smtpConnectionUri);
  let smtpCredentials;
  if (!url) {
    return (smtpCredentials = null);
  }
  if (smtpConnectionUri) {
    smtpCredentials = createTransport({
      host: decodeURIComponent(url.hostname),
      port: parseInt(url.port),
      secure: url.protocol.includes("smtps") ? true : false, // true for 465, false for other ports
      auth: {
        user: decodeURIComponent(url.username), // generated ethereal user
        pass: smtpPassword || encodeURIComponent(url.password), // generated ethereal password
      },
    });
  }
  return smtpCredentials;
};

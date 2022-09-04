import { createTransport } from "nodemailer";
import { URL } from "url";
import { invalidURI } from "./logs";
import { Config } from "./types";

export const setSmtpCredentials = (config: Config) => {
  const { smtpConnectionUri, smtpPassword } = config;
  let url = new URL(smtpConnectionUri);
  let transport;

  if (!url) {
    invalidURI(smtpConnectionUri);
<<<<<<< HEAD

=======
>>>>>>> parent of 65c80ffc (fix(firestore-send-email): added encoding for connection string passwords (#985))
    return null;
  }

  if (url.hostname && smtpPassword) {
    url.password = smtpPassword;
  }

  transport = createTransport(url.href);

  return transport;
};

import { createTransport } from "nodemailer";

export const setSmtpCredentials = (config) => {
  const {
    smtpConnectionUri,
    smtpServerDomain, // eg.smtp.gmail.com:465
    smtpServerSSL,
    smtpEmail,
    smtpPassword,
  } = config;
  let smtpCredentials;
  if (!!smtpConnectionUri && !smtpServerDomain) {
    // deprecated smtp settings version after 0.1.12
    smtpCredentials = createTransport(smtpConnectionUri);
  } else if (!!smtpServerDomain) {
    // recommended smtp setting from version 0.1.13
    const [serverHost, serverPort] = smtpServerDomain.split(":");
    smtpCredentials = createTransport({
      host: serverHost,
      port: parseInt(serverPort),
      secure: smtpServerSSL,
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });
  } else {
    smtpCredentials = null;
  }
  return smtpCredentials;
};

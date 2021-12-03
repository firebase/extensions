import Mail = require("nodemailer/lib/mailer");
import { setSmtpCredentials } from "../src/helpers";
import { Config } from "../src/types";

describe("function setSmtpCredential test returning creating nodemailer transport based on ENV config", () => {
  test("Mail config without smtpConnectionUri(SMTP_CONNECTION_URI env variable), old setting", () => {
    const config: Config = {
      smtpServerDomain: "smtp.gmail.com:25",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
  });

  test("Mail config without smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable)", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
  });

  test("Mail config with smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable) and smtpConnectionUri(SMTP_CONNECTION_URI env variable)), it should return smtpServerDomain instance credentials", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpServerDomain: "smtp.address.com:25",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(25);
    expect(credentials.options.host).toBe("smtp.address.com");
  });

  test("Mail config without smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable) and smtpConnectionUri(SMTP_CONNECTION_URI env variable). Should return null", () => {
    const config: Config = {
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeNull();
  });
});

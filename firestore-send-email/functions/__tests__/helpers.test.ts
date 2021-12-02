import Mail = require("nodemailer/lib/mailer");
import { setSmtpCredentials } from "../src/helpers";

describe("function setSmtpCredential tesst returning creating nodemailer transport based on ENV config", () => {
  test("Mail config without smtpConnectionUri(SMTP_CONNECTION_URI env variable), old setting", () => {
    const config = { smtpServerDomain: "smtp.gmail.com:25" };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
  });

  test("Mail config without smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable)", () => {
    const config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
  });
    
  test("Mail config with smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable) and smtpConnectionUri(SMTP_CONNECTION_URI env variable))", () => {
    const config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpServerDomain: "smtp.address.com:25",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(25);
    expect(credentials.options.host).toBe("smtp.address.com");
  });

  test("Mail config without smtpServerDomain(SMTP_SERVER_HOST_AND_PORT env variable) and smtpConnectionUri(SMTP_CONNECTION_URI env variable). Should return null", () => {
    const config = {};
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeNull();
  });
});

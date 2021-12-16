import Mail = require("nodemailer/lib/mailer");
import { setSmtpCredentials } from "../src/helpers";
import { Config } from "../src/types";

describe("set server credentials helper function", () => {
  test("should return smtpServerDomain credentials", () => {
    const config: Config = {
      smtpServerDomain: "smtp.gmail.com:465",
      smtpEmail: "fakeemail@gmail.com",
      smtpPassword: "fakepassword",
      smtpServerSSL: true,
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    console.log(credentials);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe(config.smtpEmail);
    expect(credentials.options.secure).toBe(true);
  });

  test("return smtpConnectionUri credentials", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);

    console.log(credentials);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.secure).toBe(true);
  });

  test("return smtpServerDomain credentials, when both config fields used", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpServerDomain: "smtp.mail.com:25",
      smtpEmail: "fakeemail2@gmail.com",
      smtpPassword: "fakepassword",
      smtpServerSSL: false,
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(25);
    expect(credentials.options.host).toBe("smtp.mail.com");
    expect(credentials.options.auth.user).toBe(config.smtpEmail);
    expect(credentials.options.secure).toBe(false);
  });

  test("return null", () => {
    const config: Config = {
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeNull();
  });
});

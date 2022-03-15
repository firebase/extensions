import Mail = require("nodemailer/lib/mailer");
import { setSmtpCredentials } from "../src/helpers";
import { Config } from "../src/types";

describe("set server credentials helper function", () => {
  test(" return smtpServerDomain credentials with new password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      smtpPassword: "fakepassword",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.pass).toBe(config.smtpPassword);
    expect(credentials.options.secure).toBe(true);
  });

  test(" return smtpServerDomain credentials with new password (old deleted)", () => {
    const config: Config = {
      smtpConnectionUri: "smtps://fakeemail@gmail.com@smtp.gmail.com:465",
      smtpPassword: "sec#:@ret-password",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.pass).toBe(config.smtpPassword);
    expect(credentials.options.secure).toBe(true);
  });

  test("return smtpConnectionUri credentials with old password", () => {
    const config: Config = {
      smtpConnectionUri:
        "smtps://fakeemail@gmail.com:secret-password@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("secret-password");
    expect(credentials.options.secure).toBe(true);
  });

  test("return smtpConnectionUri credentials without any password", () => {
    const config: Config = {
      smtpConnectionUri: "smtps://fakeemail@gmail.com@smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth.user).toBe("fakeemail@gmail.com");
    expect(credentials.options.auth.pass).toBe("");
    expect(credentials.options.secure).toBe(true);
  });

  test("return smtpConnectionUri credentials without any password and username", () => {
    const config: Config = {
      smtpConnectionUri: "smtp://smtp.gmail.com:465",
      location: "",
      mailCollection: "",
      defaultFrom: "",
    };
    const credentials = setSmtpCredentials(config);
    console.log(credentials);
    expect(credentials).toBeInstanceOf(Mail);
    expect(credentials.options.port).toBe(465);
    expect(credentials.options.host).toBe("smtp.gmail.com");
    expect(credentials.options.auth).toBe(undefined);
    expect(credentials.options.secure).toBe(false);
  });
});
